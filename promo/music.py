import numpy as np, wave
SR=44100; BPM=120; B=60/BPM; DUR=48.0
N=int(SR*DUR); L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(7)
def add(sig,t,pan=0.0,g=1.0):
    i=int(t*SR); j=min(N,i+len(sig)); s=sig[:j-i]*g
    L[i:j]+=s*(1-pan)**.5*1.0; R[i:j]+=s*(1+pan)**.5*1.0
def env(n,a=0.005,d=0.3):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-t/d); return e
def lp(x,c):  # one-pole lowpass
    y=np.zeros_like(x); a=np.exp(-2*np.pi*c/SR); acc=0.0
    b=1-a
    for i in range(len(x)): acc=b*x[i]+a*acc; y[i]=acc
    return y
def hp(x,c): return x-lp(x,c)
def f(m): return 440*2**((m-69)/12)
def kick():
    n=int(.45*SR); t=np.arange(n)/SR
    fr=45+110*np.exp(-t*28); ph=2*np.pi*np.cumsum(fr)/SR
    return np.sin(ph)*np.exp(-t*7)*1.0 + 0.3*np.exp(-t*300)*rng.standard_normal(n)*0.3
def clap():
    n=int(.25*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)
    e=np.exp(-t*25)+0.6*np.exp(-np.maximum(0,t-.012)*40)*(t>.012)
    return hp(lp(x,3500),900)*e*0.5
def hat(o=False):
    n=int((.18 if o else .05)*SR); t=np.arange(n)/SR
    return hp(rng.standard_normal(n),7000)*np.exp(-t*(18 if o else 70))*0.22
def pluck(m,d=.35,br=2800):
    n=int((d+.4)*SR); t=np.arange(n)/SR; fr=f(m)
    x=2*((t*fr)%1)-1 + 0.5*(2*((t*fr*1.005)%1)-1)
    x=lp(x,br)
    return x*env(n,.003,d)*0.16
def bass(m,d):
    n=int(d*SR); t=np.arange(n)/SR; fr=f(m)
    x=np.sin(2*np.pi*fr*t)+0.35*np.sign(np.sin(2*np.pi*fr*t))
    return lp(x,700)*np.minimum(1,t/.004)*np.exp(-t*3)*0.34
def pad(ms,d):
    n=int(d*SR); t=np.arange(n)/SR; x=np.zeros(n)
    for m in ms:
        for dt in (-0.08,0.08): x+=2*((t*f(m)*2**(dt/12))%1)-1
    x=lp(x,1200); e=np.minimum(1,t/.4)*np.minimum(1,(d-t)/.4)
    return x*e*0.022
def riser(d):
    n=int(d*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)
    y=hp(x,1500)*(t/d)**2*0.25; return y
def impact():
    n=int(2.5*SR); t=np.arange(n)/SR
    return (np.sin(2*np.pi*40*t)*np.exp(-t*2.2)*0.7 + lp(rng.standard_normal(n),1800)*np.exp(-t*3)*0.25)
# progression F Dm Bb C (1 bar each)
prog=[(53,[65,69,72]),(50,[62,65,69]),(46,[62,65,70]),(48,[64,67,72])]
bars=int(DUR/(4*B))
K=kick(); C=clap()
for bar in range(bars):
    t0=bar*4*B; root,ch=prog[bar%4]
    sec=t0
    end = sec>=44
    if not end or sec<46: add(pad(ch+[root+12],4*B),t0,0,1.0 if sec<44 else 0.8)
    # arp plucks 8ths
    arp=[ch[0],ch[1],ch[2],ch[1]+12,ch[2],ch[1],ch[0]+12,ch[2]]
    if sec<44:
        for k,m in enumerate(arp):
            pan=-.4 if k%2==0 else .4
            br=1200 if sec<4 else 3000
            add(pluck(m+12 if sec>=8 else m,.28,br),t0+k*B/2,pan,0.8 if sec<8 else 1.0)
    drums = (8<=sec<38) or (42<=sec<44)
    if sec>=4 and sec<44:
        for bt in range(4):
            if sec<8 and bt%2: continue
            add(K,t0+bt*B,0,0.9)
    if drums:
        for bt in (1,3): add(C,t0+bt*B,0.1)
        for e in range(8):
            add(hat(e%2==1),t0+e*B/2,0.3 if e%2 else -0.3)
        for e in range(8):
            if e in (0,3,4,6,7): add(bass(root-12 if e!=6 else root,B/2*0.9),t0+e*B/2)
    if 38<=sec<42:  # build: claps every beat, then 16ths
        for bt in range(4): add(C,t0+bt*B,0,0.8)
        if sec>=40:
            for s in range(8): add(C,t0+s*B/2,0,0.5)
add(riser(2.0),6.0); add(riser(4.0),38.0)
add(impact(),8.0,0,0.8); add(impact(),42.0,0,1.0)
# final chord ring
add(pad([65,69,72,77],4.0)*3,44.0)
for k,m in enumerate([77,81,84,89]): add(pluck(m,.9,3500),44.0+k*0.12,(-.3,.3)[k%2],1.2)
add(K,44.0)
mix=np.stack([L,R],1)
# fade in/out
t=np.arange(N)/SR; mix*=np.minimum(1,t/0.3)[:,None]*np.clip((DUR-t)/2.5,0,1)[:,None]
mix=np.tanh(mix*1.3)/np.tanh(1.3); mix/=np.abs(mix).max()*1.12
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix*32767).astype('<i2').tobytes()); w.close(); print('ok')
