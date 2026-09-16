"""Génère public/music.mp3 : nappe ambiante douce de substitution.

Usage : python3 scripts/make-placeholder-music.py [durée_s]
Remplacez simplement le fichier par votre propre musique.
"""
import array, math, sys
import lameenc

SR = 44100
seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 60.0
n = int(SR * seconds)
# Accord de La mineur 7 étalé, LFO lent sur l'amplitude.
freqs = [110.0, 164.81, 220.0, 261.63, 329.63]
pcm = array.array("h")
for i in range(n):
    t = i / SR
    env = min(1.0, t / 3.0) * min(1.0, (seconds - t) / 3.0)
    v = 0.0
    for k, f in enumerate(freqs):
        lfo = 0.6 + 0.4 * math.sin(2 * math.pi * (0.05 + 0.017 * k) * t + k)
        v += lfo * math.sin(2 * math.pi * f * t) / len(freqs)
    s = int(max(-1.0, min(1.0, 0.5 * env * v)) * 32767)
    pcm.append(s)
    pcm.append(s)
enc = lameenc.Encoder()
enc.set_bit_rate(128)
enc.set_in_sample_rate(SR)
enc.set_channels(2)
enc.set_quality(2)
data = enc.encode(pcm.tobytes()) + enc.flush()
with open("public/music.mp3", "wb") as f:
    f.write(data)
print(f"public/music.mp3 : {seconds:.0f} s, {len(data)/1024:.0f} Ko")
