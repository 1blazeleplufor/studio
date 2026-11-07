import numpy as np, time, threading
class ExternalPlugin:
    is_instrument=False
    def __init__(self,name):self.name=name;self._state=b'etat-initial';self.calls=0
    def process(self,x,sample_rate,buffer_size=None,reset=True):
        self.calls+=1;y=np.array(x,dtype=np.float32)*0.5
        if y.shape[0]>1:y[1]*=-1
        return y
    @property
    def raw_state(self):return self._state
    @raw_state.setter
    def raw_state(self,v):self._state=bytes(v)
    def show_editor(self,ev=None):
        assert threading.current_thread() is threading.main_thread(),"editor hors fil principal"
        print("MOCK: fenêtre ouverte",self.name,flush=True);ev.wait(1.0);self._state=b'etat-modifie';print("MOCK: fenêtre fermée",flush=True)
    def reset(self):pass
class VST3Plugin:
    @staticmethod
    def get_plugin_names_for_file(p):return ['Fake Comp','Fake EQ']
class AudioUnitPlugin:
    @staticmethod
    def get_plugin_names_for_file(p):return ['Acme: Super Synth']
def load_plugin(path,plugin_name=None):return ExternalPlugin(plugin_name)
