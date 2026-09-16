/**
 * Pulumi entry (scaffold).
 * Do not create real cloud resources until hosting + secrets ADRs exist.
 */
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config("zunia");

export const apiHostname = cfg.get("apiHostname") ?? "api.zunialab.com";
export const linkHostname = cfg.get("linkHostname") ?? "link.zunialab.com";
export const statusHostname = cfg.get("statusHostname") ?? "status.zunialab.com";

// Resources intentionally omitted.
