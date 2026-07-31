const fs = require('fs');

const sampleRate = 44100;
const durationSeconds = 45;
const numSamples = sampleRate * durationSeconds;
const buffer = Buffer.alloc(44 + numSamples * 2);

// WAV header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
buffer.writeUInt16LE(1, 22);  // NumChannels (1 for Mono)
buffer.writeUInt32LE(sampleRate, 24); // SampleRate
buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
buffer.writeUInt16LE(2, 32);  // BlockAlign
buffer.writeUInt16LE(16, 34); // BitsPerSample
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * 2, 40);

// Frequencies for a warm luxurious ambient chord (F minor 9: F3, Ab3, C4, Eb4, G4)
const freqs = [174.61, 207.65, 261.63, 311.13, 392.00];

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  
  // Gentle envelope: fade in over 3s, sustain, fade out over last 3s with subtle LFO
  let envelope = 1.0;
  if (t < 3) envelope = t / 3;
  if (t > durationSeconds - 3) envelope = (durationSeconds - t) / 3;
  
  // LFO for breathing effect (0.1 Hz)
  const lfo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.1 * t);

  let sample = 0;
  freqs.forEach((f, idx) => {
    // Slight detune per oscillator for warmth
    const detune = 1 + (idx - 2) * 0.002;
    // Add harmonics and gentle sine combination
    const s = Math.sin(2 * Math.PI * f * detune * t) * 0.4
            + Math.sin(2 * Math.PI * (f * 1.5) * detune * t) * 0.15
            + Math.sin(2 * Math.PI * (f * 2) * detune * t) * 0.05;
    sample += s;
  });

  // Normalize and scale
  sample = (sample / freqs.length) * 0.3 * envelope * lfo;
  
  // Convert to 16-bit PCM integer
  const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
  buffer.writeInt16LE(Math.floor(intSample), 44 + i * 2);
}

fs.writeFileSync('C:\\Users\\Richrx\\Documents\\Cloud stuff\\detailing-marketplace\\my-video\\ambient.wav', buffer);
console.log('ambient.wav generated successfully.');
