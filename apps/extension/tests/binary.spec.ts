import { arrayBufferToBase64, base64ToArrayBuffer } from '../src/shared/binary';

describe('arrayBufferToBase64 / base64ToArrayBuffer', () => {
  it('faz o round-trip preservando todos os bytes (0-255)', () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) original[i] = i;

    const base64 = arrayBufferToBase64(original.buffer);
    const roundTripped = new Uint8Array(base64ToArrayBuffer(base64));

    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });

  it('lida com buffers maiores que um chunk de encode (> 32KB)', () => {
    const size = 100_000;
    const original = new Uint8Array(size);
    for (let i = 0; i < size; i++) original[i] = i % 256;

    const base64 = arrayBufferToBase64(original.buffer);
    const roundTripped = new Uint8Array(base64ToArrayBuffer(base64));

    expect(roundTripped.length).toBe(size);
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });

  it('lida com buffer vazio', () => {
    const base64 = arrayBufferToBase64(new ArrayBuffer(0));
    const roundTripped = base64ToArrayBuffer(base64);

    expect(roundTripped.byteLength).toBe(0);
  });
});
