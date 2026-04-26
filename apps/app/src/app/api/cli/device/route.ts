import { NextResponse } from "next/server";
import type { CliDeviceStartResponse } from "@offsprint/shared";
import { env } from "@/env";
import {
  createDeviceCode,
  DEVICE_CODE_TTL_MS,
  DEVICE_POLL_INTERVAL_S,
} from "@/lib/cli-tokens";

export const runtime = "nodejs";

export async function POST() {
  const { deviceCode, userCode } = await createDeviceCode();
  const base = env.appBaseUrlNoTrailingSlash();
  const verificationUrl = `${base}/cli/device`;
  const verificationUrlComplete = `${verificationUrl}?code=${encodeURIComponent(userCode)}`;
  const body: CliDeviceStartResponse = {
    deviceCode,
    userCode,
    verificationUrl,
    verificationUrlComplete,
    expiresIn: Math.floor(DEVICE_CODE_TTL_MS / 1000),
    interval: DEVICE_POLL_INTERVAL_S,
  };
  return NextResponse.json(body);
}
