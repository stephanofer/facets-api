import { Test, TestingModule } from '@nestjs/testing';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { VoucherAnalyzerController } from '@modules/voucher-analyzer/voucher-analyzer.controller';
import { VoucherAnalyzerService } from '@modules/voucher-analyzer/voucher-analyzer.service';

describe('VoucherAnalyzerController', () => {
  let controller: VoucherAnalyzerController;
  let moduleRef: TestingModule;
  let service: jest.Mocked<VoucherAnalyzerService>;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [VoucherAnalyzerController],
      providers: [
        {
          provide: VoucherAnalyzerService,
          useValue: {
            analyze: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(VoucherAnalyzerController);
    service = moduleRef.get(VoucherAnalyzerService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should expose POST /voucher-analyzer', () => {
    expect(Reflect.getMetadata(PATH_METADATA, VoucherAnalyzerController)).toBe(
      'voucher-analyzer',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, controller.analyze)).toBe(
      RequestMethod.POST,
    );
  });

  it('should delegate analysis to the service with workspace-aware principal context and request id', async () => {
    service.analyze.mockResolvedValue({
      status: 'NOT_VOUCHER',
      document: { type: 'unknown', confidence: 0.75 },
      extraction: { text: null, fields: null },
      diagnostics: {
        model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
        warnings: ['not a voucher'],
      },
    });

    const result = await controller.analyze(
      {
        sub: 'user-1',
        email: 'test@test.com',
        workspaceId: 'workspace-1',
        actorUserId: 'user-1',
        membershipId: 'membership-1',
        workspaceRole: 'ADMIN',
        platformRole: 'USER',
        user: {} as never,
        workspace: {} as never,
        membership: {} as never,
      } as never,
      { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]) } as Express.Multer.File,
      { id: 'req-1' } as never,
    );

    expect(service.analyze).toHaveBeenCalledWith(
      {
        sub: 'user-1',
        workspaceId: 'workspace-1',
      },
      expect.any(Object),
      'req-1',
    );
    expect(result.status).toBe('NOT_VOUCHER');
  });
});
