#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Studio Bridge — ouvre les plugins AU / VST3 installés sur l'ordinateur depuis Studio.

Fonctionnement :
  • scanne les dossiers de plugins (Mac : Components + VST3 ; Windows : VST3),
  • écoute sur http://127.0.0.1:47123 (WebSocket /ws) — uniquement sur cet ordinateur,
  • charge les plugins demandés par Studio (bibliothèque Spotify « pedalboard »),
  • ouvre leur fenêtre d'origine et traite le son des pistes en temps réel.
Sert aussi l'appli Studio elle-même sur http://localhost:47123 (utile pour Safari).

Dépendances : pip install pedalboard numpy
"""
import asyncio, base64, hashlib, json, os, platform, struct, sys, threading, queue, time, glob, traceback, mimetypes, plistlib

VERSION = "1.0"
PORT = int(os.environ.get("STUDIO_BRIDGE_PORT", "47123"))
HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.abspath(os.path.join(HERE, ".."))          # dépôt Studio : index.html à la racine
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".studio_bridge")
CACHE_FILE = os.path.join(CACHE_DIR, "plugins.json")
MAGIC = 0x31414253                                            # « SBA1 » : bloc audio
ALLOWED_ORIGINS = {"https://1blazeleplufor.github.io", f"http://localhost:{PORT}", f"http://127.0.0.1:{PORT}", "null", ""}
ALLOWED_ORIGINS |= set(filter(None, os.environ.get("STUDIO_BRIDGE_ORIGINS", "").split(",")))

try:
    import numpy as np
except Exception as e:
    np = None
try:
    import pedalboard
    HAVE_PB, PB_ERR = True, ""
except Exception as e:
    pedalboard, HAVE_PB, PB_ERR = None, False, f"{type(e).__name__}: {e}"

def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)

# ---------------------------------------------------------------- fil principal
# Sur Mac, les fenêtres des plugins (et parfois leur chargement) doivent passer par le fil principal.
MAINQ: "queue.Queue" = queue.Queue()

def on_main(fn, timeout=120):
    """Exécute fn() sur le fil principal et attend le résultat."""
    if threading.current_thread() is threading.main_thread():
        return fn()
    box, ev = {}, threading.Event()
    def job():
        try: box["r"] = fn()
        except Exception as e: box["e"] = e
        finally: ev.set()
    MAINQ.put(job)
    if not ev.wait(timeout): raise TimeoutError("fil principal occupé (une fenêtre de plugin est peut-être ouverte)")
    if "e" in box: raise box["e"]
    return box.get("r")

# ---------------------------------------------------------------- scan des plugins
def plugin_dirs():
    home, s = os.path.expanduser("~"), platform.system()
    extra = [d for d in os.environ.get("STUDIO_BRIDGE_DIRS", "").split(os.pathsep) if d]
    if s == "Darwin":
        dirs = [("AU", "/Library/Audio/Plug-Ins/Components", "*.component"), ("AU", home + "/Library/Audio/Plug-Ins/Components", "*.component"),
                ("VST3", "/Library/Audio/Plug-Ins/VST3", "**/*.vst3"), ("VST3", home + "/Library/Audio/Plug-Ins/VST3", "**/*.vst3")]
    elif s == "Windows":
        pf = os.environ.get("CommonProgramFiles", r"C:\Program Files\Common Files")
        dirs = [("VST3", os.path.join(pf, "VST3"), "**/*.vst3"), ("VST3", os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Common", "VST3"), "**/*.vst3")]
    else:
        dirs = [("VST3", home + "/.vst3", "**/*.vst3"), ("VST3", "/usr/lib/vst3", "**/*.vst3"), ("VST3", "/usr/local/lib/vst3", "**/*.vst3")]
    for d in extra:
        dirs += [("AU", d, "*.component"), ("VST3", d, "**/*.vst3")]
    return dirs

def bundle_info(path, fmt):
    """Fabricant / type (instrument ou effet) lus dans les métadonnées du paquet, sans charger le plugin."""
    vendor, kind, names = "", "effect", []
    try:
        if fmt == "AU":
            with open(os.path.join(path, "Contents", "Info.plist"), "rb") as f:
                info = plistlib.load(f)
            for c in info.get("AudioComponents", []) or []:
                nm = str(c.get("name", ""))
                if ": " in nm: v, n = nm.split(": ", 1)
                else: v, n = c.get("manufacturer", ""), nm
                vendor = vendor or str(v)
                if c.get("type") in ("aumu", "aumi"): kind = "instrument"
                names.append(n)
        else:
            mi = os.path.join(path, "Contents", "Resources", "moduleinfo.json")
            if os.path.exists(mi):
                with open(mi, "r", encoding="utf-8", errors="ignore") as f:
                    txt = "".join(l for l in f if not l.strip().startswith("//"))
                info = json.loads(txt)
                vendor = (info.get("Factory Info", {}) or {}).get("Vendor", "")
                for c in info.get("Classes", []) or []:
                    if c.get("Category") == "Audio Module Class":
                        if "Instrument" in str(c.get("Sub Categories", "")): kind = "instrument"
                        names.append(c.get("Name", ""))
    except Exception:
        pass
    return vendor, kind, [n for n in names if n]

def scan(force=False, progress=None):
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache = {}
    if not force and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f: cache = json.load(f)
        except Exception: cache = {}
    found, out, bundles = {}, [], []
    for fmt, d, pat in plugin_dirs():
        if os.path.isdir(d):
            for p in sorted(glob.glob(os.path.join(d, pat), recursive=True)):
                bundles.append((fmt, p))
    for k, (fmt, path) in enumerate(bundles):
        if progress: progress(k, len(bundles), os.path.basename(path))
        try: mtime = os.path.getmtime(path)
        except OSError: continue
        c = cache.get(path)
        if c and c.get("mtime") == mtime and not force:
            entry = c
        else:
            vendor, kind, meta_names = bundle_info(path, fmt)
            names = []
            if HAVE_PB:
                try:
                    cls = pedalboard.AudioUnitPlugin if fmt == "AU" else pedalboard.VST3Plugin
                    names = list(on_main(lambda: cls.get_plugin_names_for_file(path), 60) or [])
                except Exception as e:
                    log("  ⚠", os.path.basename(path), ":", e)
            if not names: names = meta_names or [os.path.splitext(os.path.basename(path))[0]]
            entry = {"mtime": mtime, "fmt": fmt, "vendor": vendor, "kind": kind, "names": names}
        found[path] = entry
        for n in entry["names"]:
            disp, vend = n, entry.get("vendor", "")
            if ": " in n and fmt == "AU": vend, disp = n.split(": ", 1)
            out.append({"id": f"{fmt}|{path}|{n}", "name": disp, "vendor": vend or "Autres", "fmt": fmt, "kind": entry.get("kind", "effect"), "path": path, "pname": n})
    with open(CACHE_FILE, "w", encoding="utf-8") as f: json.dump(found, f)
    out.sort(key=lambda x: (x["vendor"].lower(), x["name"].lower(), x["fmt"]))
    return out

# ---------------------------------------------------------------- instances de plugins
class Inst:
    def __init__(self, num, pid, sr, plugin, name):
        self.num, self.pid, self.sr, self.plugin, self.name = num, pid, sr, plugin, name
        self.close_ev = None; self.lock = threading.Lock()

def load_instance(pid, sr):
    fmt, path, pname = pid.split("|", 2)
    def do():
        return pedalboard.load_plugin(path, plugin_name=pname)
    try:
        plug = do()                       # la plupart des plugins se chargent hors du fil principal…
    except Exception as e1:
        log("  chargement sur le fil principal :", e1)
        plug = on_main(do)                # …les autres (certains AU) exigent le fil principal
    return plug

# ---------------------------------------------------------------- serveur HTTP + WebSocket minimal
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

class WS:
    def __init__(self, reader, writer):
        self.r, self.w, self.closed = reader, writer, False
        self.wlock = asyncio.Lock()
    async def recv(self):
        """Renvoie (opcode, données) ; gère ping / fragmentation simple."""
        buf, op0 = b"", None
        while True:
            h = await self.r.readexactly(2)
            fin, op, masked, ln = h[0] & 0x80, h[0] & 0x0F, h[1] & 0x80, h[1] & 0x7F
            if ln == 126: ln = struct.unpack(">H", await self.r.readexactly(2))[0]
            elif ln == 127: ln = struct.unpack(">Q", await self.r.readexactly(8))[0]
            mask = await self.r.readexactly(4) if masked else None
            data = await self.r.readexactly(ln) if ln else b""
            if mask:
                if np is not None and ln > 64:
                    m = np.frombuffer(mask * ((ln + 3) // 4), dtype=np.uint8)[:ln]
                    data = (np.frombuffer(data, dtype=np.uint8) ^ m).tobytes()
                else:
                    data = bytes(b ^ mask[i & 3] for i, b in enumerate(data))
            if op == 9: await self.send(data, 10); continue
            if op == 10: continue
            if op == 8: self.closed = True; return 8, b""
            if op != 0: op0 = op
            buf += data
            if fin: return op0, buf
    async def send(self, data, op=None):
        if self.closed: return
        if isinstance(data, str): data, op = data.encode("utf-8"), op or 1
        op = op or 2; n = len(data)
        if n < 126: hdr = struct.pack(">BB", 0x80 | op, n)
        elif n < 65536: hdr = struct.pack(">BBH", 0x80 | op, 126, n)
        else: hdr = struct.pack(">BBQ", 0x80 | op, 127, n)
        async with self.wlock:
            try:
                self.w.write(hdr + data); await self.w.drain()
            except Exception:
                self.closed = True
    async def json(self, obj):
        await self.send(json.dumps(obj, ensure_ascii=False))

STATE = {"plugins": [], "scanning": False, "progress": "", "clients": set(), "loop": None}

async def broadcast(obj):
    for c in list(STATE["clients"]):
        await c.json(obj)

def from_thread(coro):
    loop = STATE["loop"]
    if loop: asyncio.run_coroutine_threadsafe(coro, loop)

def start_scan(force=False):
    if STATE["scanning"]: return
    STATE["scanning"] = True
    def run():
        try:
            def prog(k, n, name):
                STATE["progress"] = f"{k + 1}/{n} {name}"
                if k % 5 == 0: from_thread(broadcast({"t": "scanning", "progress": STATE["progress"]}))
            log("Scan des plugins…")
            STATE["plugins"] = scan(force, prog)
            log(f"{len(STATE['plugins'])} plugins trouvés.")
        except Exception as e:
            log("Erreur de scan :", e); traceback.print_exc()
        finally:
            STATE["scanning"] = False
            from_thread(broadcast({"t": "plugins", "plugins": STATE["plugins"]}))
    threading.Thread(target=run, daemon=True).start()

async def client_loop(ws):
    insts = {}
    STATE["clients"].add(ws)
    loop = asyncio.get_running_loop()
    try:
        while not ws.closed:
            op, data = await ws.recv()
            if op == 8: break
            if op == 2:                                    # ---- bloc audio
                if len(data) < 20: continue
                magic, num, start, frames, ch = struct.unpack_from("<IIIII", data, 0)
                inst = insts.get(num)
                if magic != MAGIC or inst is None or np is None: continue
                x = np.frombuffer(data, dtype=np.float32, offset=20, count=frames * ch).reshape(ch, frames)
                try:
                    with inst.lock:
                        y = inst.plugin.process(x, sample_rate=inst.sr, buffer_size=frames, reset=False)
                    y = np.asarray(y, dtype=np.float32)
                    if y.ndim == 1: y = y[None, :]
                    if y.shape[0] < ch: y = np.vstack([y] * ch)[:ch]
                    y = np.ascontiguousarray(y[:ch, :frames])
                    if y.shape[1] < frames: y = np.pad(y, ((0, 0), (0, frames - y.shape[1])))
                except Exception as e:
                    y = x
                await ws.send(struct.pack("<IIIII", MAGIC, num, start, frames, ch) + y.tobytes(), 2)
                continue
            try: m = json.loads(data.decode("utf-8"))
            except Exception: continue
            t = m.get("t")
            if t == "hello":
                await ws.json({"t": "hello", "v": VERSION, "ok": HAVE_PB, "err": PB_ERR, "os": platform.system(),
                               "scanning": STATE["scanning"], "plugins": STATE["plugins"]})
            elif t == "scan":
                start_scan(force=bool(m.get("force")))
                await ws.json({"t": "scanning", "progress": "démarrage"})
            elif t == "load":
                num, pid, sr = int(m["num"]), m["pid"], float(m.get("sr", 48000))
                if not HAVE_PB:
                    await ws.json({"t": "error", "num": num, "msg": "pedalboard n'est pas installé : " + PB_ERR}); continue
                try:
                    plug = await loop.run_in_executor(None, load_instance, pid, sr)
                    if m.get("state"):
                        try: plug.raw_state = base64.b64decode(m["state"])
                        except Exception as e: log("  état non restauré :", e)
                    inst = Inst(num, pid, sr, plug, pid.split("|", 2)[2]); insts[num] = inst
                    is_instr = bool(getattr(plug, "is_instrument", False))
                    log("Chargé :", inst.name, f"({pid.split('|')[0]})")
                    await ws.json({"t": "loaded", "num": num, "name": inst.name, "instrument": is_instr})
                except Exception as e:
                    log("Échec du chargement :", pid, e)
                    await ws.json({"t": "error", "num": num, "msg": f"{type(e).__name__}: {e}"})
            elif t == "unload":
                inst = insts.pop(int(m["num"]), None)
                if inst and inst.close_ev: inst.close_ev.set()
            elif t == "edit":
                inst = insts.get(int(m["num"]))
                if not inst: continue
                if inst.close_ev and not inst.close_ev.is_set():
                    continue                                   # déjà ouverte
                ev = threading.Event(); inst.close_ev = ev
                def show(inst=inst, ev=ev):
                    try:
                        inst.plugin.show_editor(ev)
                    except Exception as e:
                        log("Fenêtre impossible :", e)
                        from_thread(ws.json({"t": "error", "num": inst.num, "msg": "Fenêtre : " + str(e)}))
                    finally:
                        ev.set()
                        st = None
                        try: st = base64.b64encode(inst.plugin.raw_state).decode("ascii")
                        except Exception: pass
                        from_thread(ws.json({"t": "editor_closed", "num": inst.num, "state": st}))
                MAINQ.put(show)
                await ws.json({"t": "editor_open", "num": inst.num})
            elif t == "close_editor":
                inst = insts.get(int(m["num"]))
                if inst and inst.close_ev: inst.close_ev.set()
            elif t == "getstate":
                inst = insts.get(int(m["num"]))
                if inst:
                    try: st = base64.b64encode(inst.plugin.raw_state).decode("ascii")
                    except Exception as e: st = None
                    await ws.json({"t": "state", "num": inst.num, "state": st})
            elif t == "reset":
                inst = insts.get(int(m["num"]))
                if inst:
                    try:
                        with inst.lock: inst.plugin.reset()
                    except Exception: pass
    except (asyncio.IncompleteReadError, ConnectionError):
        pass
    finally:
        STATE["clients"].discard(ws)
        for inst in insts.values():
            if inst.close_ev: inst.close_ev.set()
        log("Studio déconnecté.")

async def handle(reader, writer):
    try:
        head = await reader.readuntil(b"\r\n\r\n")
    except Exception:
        writer.close(); return
    lines = head.decode("latin-1").split("\r\n")
    try: method, path, _ = lines[0].split(" ", 2)
    except ValueError: writer.close(); return
    hdr = {}
    for l in lines[1:]:
        if ":" in l:
            k, v = l.split(":", 1); hdr[k.strip().lower()] = v.strip()
    if hdr.get("upgrade", "").lower() == "websocket":
        origin = hdr.get("origin", "")
        if origin not in ALLOWED_ORIGINS:
            log("Connexion refusée depuis", origin)
            writer.write(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n"); await writer.drain(); writer.close(); return
        acc = base64.b64encode(hashlib.sha1((hdr.get("sec-websocket-key", "") + GUID).encode()).digest()).decode()
        writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                      f"Sec-WebSocket-Accept: {acc}\r\n\r\n").encode())
        await writer.drain()
        log("Studio connecté (", origin or "local", ")")
        await client_loop(WS(reader, writer))
        try: writer.close()
        except Exception: pass
        return
    # ---- fichiers de l'appli (http://localhost:PORT/)
    p = path.split("?")[0].split("#")[0]
    if p in ("", "/"): p = "/index.html"
    if p == "/status":
        body = json.dumps({"bridge": VERSION, "ok": HAVE_PB, "plugins": len(STATE["plugins"])}).encode()
        ctype = "application/json"; code = "200 OK"
    else:
        fp = os.path.abspath(os.path.join(APP_DIR, p.lstrip("/")))
        if fp.startswith(APP_DIR) and os.path.isfile(fp) and "/.git" not in fp.replace("\\", "/"):
            with open(fp, "rb") as f: body = f.read()
            ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"; code = "200 OK"
            if fp.endswith(".js"): ctype = "text/javascript"
            if fp.endswith(".webmanifest"): ctype = "application/manifest+json"
        else:
            body, ctype, code = b"Introuvable", "text/plain", "404 Not Found"
    writer.write(f"HTTP/1.1 {code}\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\n\r\n".encode() + body)
    try:
        await writer.drain()
    finally:
        writer.close()

def serve_forever():
    async def main():
        STATE["loop"] = asyncio.get_running_loop()
        server = await asyncio.start_server(handle, "127.0.0.1", PORT)
        log(f"Studio Bridge {VERSION} prêt : http://localhost:{PORT}  (laissez cette fenêtre ouverte)")
        start_scan()
        async with server:
            await server.serve_forever()
    try:
        asyncio.run(main())
    except OSError as e:
        log(f"Impossible d'écouter sur le port {PORT} : {e}. Studio Bridge est peut-être déjà lancé.")
        os._exit(1)

def main():
    print("=" * 60)
    print(f"  Studio Bridge {VERSION} — plugins AU / VST3 pour Studio")
    print("=" * 60)
    if not HAVE_PB:
        print("⚠ pedalboard n'est pas installé :", PB_ERR)
        print("  → lancez :  python3 -m pip install pedalboard numpy")
    if np is None:
        print("⚠ numpy n'est pas installé → python3 -m pip install numpy")
    threading.Thread(target=serve_forever, daemon=True).start()
    # Fil principal : fenêtres des plugins (obligatoire sur Mac)
    try:
        while True:
            try: job = MAINQ.get(timeout=0.25)
            except queue.Empty: continue
            try: job()
            except Exception: traceback.print_exc()
    except KeyboardInterrupt:
        print("\nAu revoir 👋")

if __name__ == "__main__":
    main()
