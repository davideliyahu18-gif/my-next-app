export type BridgeChannelMessage = {
  id: string;
  channel: string;
  channelLabel: string;
  url: string;
  text: string;
  datetime: string;
  imageUrl?: string;
};

export type BridgeChannelConfig = {
  username: string;
  label: string;
};

export type BridgePollSummary = {
  ok: boolean;
  configured: boolean;
  channels: string[];
  scanned: number;
  fresh: number;
  sent: number;
  skipped: number;
  bootstrapped: boolean;
  dryRun: boolean;
  errors: string[];
  sentIds: string[];
};
