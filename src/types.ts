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
}

export interface Quote {
  quoteName: string;
  quoteRef: string;
  firewall: FirewallTier;
  servers: ServerConfig[];
}
