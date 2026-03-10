export interface AiExecutionMetadata {
  capability: string;
  model: string;
  provider?: string;
  gatewayModel?: string;
  requestId?: string;
}

export interface AiExecutionResult<TParsed = unknown> {
  raw: unknown;
  text: string | null;
  json: Record<string, unknown> | Array<unknown> | null;
  parsed: TParsed | null;
  metadata: AiExecutionMetadata;
}
