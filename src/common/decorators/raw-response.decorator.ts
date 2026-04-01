import { applyDecorators, SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_ENVELOPE_KEY = 'skipResponseEnvelope';
export const SKIP_ERROR_ENVELOPE_KEY = 'skipErrorEnvelope';

export const SkipResponseEnvelope = () =>
  SetMetadata(SKIP_RESPONSE_ENVELOPE_KEY, true);

export const SkipErrorEnvelope = () =>
  SetMetadata(SKIP_ERROR_ENVELOPE_KEY, true);

export const RawResponse = () =>
  applyDecorators(SkipResponseEnvelope(), SkipErrorEnvelope());
