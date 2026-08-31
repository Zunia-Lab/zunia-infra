/**
 * Pulumi entry (scaffold).
 * Do not create real cloud resources until hosting + secrets ADRs exist.
 */
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config("zunia");

export const apiHostname = cfg.get("apiHostname") ?? "api.zuniawallet.com";
export const linkHostname = cfg.get("linkHostname") ?? "link.zuniawallet.com";
export const statusHostname = cfg.get("statusHostname") ?? "status.zuniawallet.com";

// Resources intentionally omitted.
