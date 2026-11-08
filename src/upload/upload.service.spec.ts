import { UploadService } from './upload.service';

describe('UploadService failure handling', () => {
  const usersRepository = { findOne: jest.fn(), save: jest.fn() };
  const authorsRepository = { update: jest.fn() };
  const creatorsRepository = { update: jest.fn() };
  const i18n = { t: (key: string) => key };
  let service: UploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UploadService(
      usersRepository as never,
      authorsRepository as never,
      creatorsRepository as never,
      i18n as never,
    );
  });

  it('keeps the current avatar if uploading the replacement fails', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'user-1', profileUrl: null });
    jest.spyOn(service, 'uploadFile').mockRejectedValue(new Error('R2 unavailable'));
    const deleteSpy = jest.spyOn(service, 'deleteFile');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    await expect(
      service.uploadAvatar('user-1', {
        mimetype: 'image/png',
        size: 4,
        buffer: png,
      }),
    ).rejects.toThrow('R2 unavailable');

    expect(usersRepository.save).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('removes images already uploaded when a later image fails', async () => {
    jest
      .spyOn(service, 'uploadFile')
      .mockResolvedValueOnce('https://cdn.hayahbook.com/posts/images/one.png')
      .mockRejectedValueOnce(new Error('R2 unavailable'));
    const deleteSpy = jest.spyOn(service, 'deleteFileByUrl').mockResolvedValue();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const files = [1, 2].map(() => ({
      mimetype: 'image/png',
      size: 4,
      buffer: png,
    }));

    await expect(service.uploadPostImages('user-1', files)).rejects.toThrow(
      'R2 unavailable',
    );
    expect(deleteSpy).toHaveBeenCalledWith(
      'https://cdn.hayahbook.com/posts/images/one.png',
    );
  });

  it('rejects an image whose bytes do not match its declared MIME type', async () => {
    const uploadSpy = jest.spyOn(service, 'uploadFile');
    await expect(
      service.uploadPostImages('user-1', [
        {
          mimetype: 'image/png',
          size: 4,
          buffer: Buffer.from('<html>'),
        },
      ]),
    ).rejects.toThrow('upload.invalid_file_type');
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
