import { fallbackPhotoTitle, isOpaqueFileName, titleForImportedPhoto } from './photo-title';

describe('titleForImportedPhoto', () => {
  it('keeps a name the player would recognise', () => {
    expect(titleForImportedPhoto('beach-sunset.jpg', 'My photo 1')).toBe('beach sunset');
    expect(titleForImportedPhoto('Grandma_and_the_dog.png', 'My photo 1')).toBe(
      'Grandma and the dog',
    );
    expect(titleForImportedPhoto('Trip to Kyoto.heic', 'My photo 1')).toBe('Trip to Kyoto');
  });

  it('rejects the cropped-copy UUID the picker actually returns', () => {
    // The exact shape that shipped as a puzzle title: cropping in the picker
    // makes Android hand back a new file named with a UUID.
    expect(titleForImportedPhoto('2c2550e4-36fc-4a2b-9e77-1f3c5d9b0e21.jpg', 'My photo 3')).toBe(
      'My photo 3',
    );
    expect(titleForImportedPhoto('2c2550e436fc4a2b9e771f3c5d9b0e21.jpg', 'My photo 3')).toBe(
      'My photo 3',
    );
  });

  it('rejects hashes, timestamps and camera conventions', () => {
    for (const name of [
      'a3f9c2b81e4d7a60.png',
      '1690000000.jpg',
      'IMG_20260823_120000.jpg',
      'PXL_20260823_120000123.jpg',
      'DSC01234.JPG',
      'Screenshot_20260823-120000.png',
      'image_1690000000.jpeg',
    ]) {
      expect(titleForImportedPhoto(name, 'My photo 2')).toBe('My photo 2');
    }
  });

  it('falls back when there is no name at all', () => {
    expect(titleForImportedPhoto(null, 'My photo 1')).toBe('My photo 1');
    expect(titleForImportedPhoto(undefined, 'My photo 1')).toBe('My photo 1');
    expect(titleForImportedPhoto('', 'My photo 1')).toBe('My photo 1');
    expect(titleForImportedPhoto('___.jpg', 'My photo 1')).toBe('My photo 1');
  });

  it('does not mistake a real name that merely contains digits', () => {
    expect(titleForImportedPhoto('summer 2026.jpg', 'My photo 1')).toBe('summer 2026');
    expect(titleForImportedPhoto('cat-2.png', 'My photo 1')).toBe('cat 2');
  });

  it('truncates a long real name rather than discarding it', () => {
    const long = 'the day we all went down to the river and stayed until dark.jpg';
    expect(titleForImportedPhoto(long, 'My photo 1')).toBe(
      'the day we all went down to the river an',
    );
  });

  it('does not mistake a long word built from hex letters for a hash', () => {
    // `a`-`f` are letters. Without the digit requirement in HEX_BLOB, this is
    // indistinguishable from a content hash and the name would be thrown away.
    expect(titleForImportedPhoto('deadbeefcafebabe.jpg', 'My photo 1')).toBe('deadbeefcafebabe');
  });

  it('keeps a name with no extension', () => {
    expect(titleForImportedPhoto('holiday', 'My photo 1')).toBe('holiday');
  });
});

describe('isOpaqueFileName', () => {
  it('is the predicate the title falls back on', () => {
    expect(isOpaqueFileName('2c2550e4-36fc-4a2b-9e77-1f3c5d9b0e21')).toBe(true);
    expect(isOpaqueFileName('beach sunset')).toBe(false);
  });
});

describe('fallbackPhotoTitle', () => {
  it('numbers from one, so successive imports stay distinguishable', () => {
    expect(fallbackPhotoTitle(0)).toBe('My photo 1');
    expect(fallbackPhotoTitle(2)).toBe('My photo 3');
  });

  it('survives a nonsense count', () => {
    expect(fallbackPhotoTitle(-4)).toBe('My photo 1');
  });
});
