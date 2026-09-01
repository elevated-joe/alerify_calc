export type OS = "linux" | "windows";
export type FirewallTier = "standard" | "advanced";

export interface Instance {
  family: string;
  name: string;
  vcpu: number;
  ram: number;
  linuxClient: number;
  linuxCost: number;
  winClient: number;
  winCost: number;
}

export interface Rate {
  client: number;
  cost: number;
}

export interface Addons {
  ebsPerGB: Rate;
  elasticIp: Rate;
  firewallStd: Rate;
  firewallAdv: Rate;
  sqlPer2Core: Rate;
  sqlMinCores: number;
  rdsCal: Rate;
  // Backups. Storage rates are per GB of backup data per month; the license is
  // flat per server with local backup. Backup size = EBS × daily change × retention.
  localBackupPerGB: Rate;
  offsiteBackupPerGB: Rate;
  backupLicense: Rate;
  backupDailyChangeRate: number; // e.g. 0.10 = 10% of EBS changes per day
}

export interface Provider {
  label: string;
  vcpuHr: number;
  gbHr: number;
  winVcpuHr: number;
  storageGB: number;
  ipMonth: number;
  sqlPer2Core: number;
  egressGB: number;
}

export interface Compare {
  hoursMonth: number;
  avgEgressGBPerServer: number;
  aws: Provider;
  azure: Provider;
}

export interface Pricing {
  compute: Instance[];
  addons: Addons;
  compare: Compare;
  colo: import("./coloData").ColoCatalog;
}

export interface ServerConfig {
  id: string;
  name: string;
  os: OS;
  vcpu: number;
  ram: number;
  ebs: number;
  eip: number;
  rds: number;
  sql: boolean;
  localBackup: boolean;
  offsiteBackup: boolean; // requires localBackup
  backupRetentionDays: number;
}

export interface Quote {
  quoteName: string;
  quoteRef: string;
  firewall: FirewallTier;
  servers: ServerConfig[];
  // One-time installation & setup charges shown on the proposal.
  setupClient: number; // "Client setup" line (default 0)
  setupAdmin: number; // "Admin setup fee" line (default 185)
}
