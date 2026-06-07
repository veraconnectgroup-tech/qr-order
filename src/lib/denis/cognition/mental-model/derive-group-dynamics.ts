import type { GuestGroupDynamics } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { TablePartyModel } from "@/lib/denis/venue/party/types";

/** Party leader/follower routing from TablePartyModel (ADR-038 Val C). */
export function deriveGroupDynamics(
  party: TablePartyModel | null | undefined
): GuestGroupDynamics {
  if (!party || party.activeDeviceCount <= 1) {
    return {
      mode: "solo",
      leaderDevice: party?.currentDeviceFingerprint ?? null,
      followerDevices: [],
      addressLeader: true,
    };
  }

  const primary =
    party.devices.find((device) => device.isPrimary) ?? party.devices[0] ?? null;
  const leaderDevice = primary?.deviceFingerprint ?? null;
  const followerDevices = party.devices
    .filter((device) => !device.isPrimary)
    .map((device) => device.deviceFingerprint);

  return {
    mode: "party",
    leaderDevice,
    followerDevices,
    addressLeader: party.isCurrentDevicePrimary,
  };
}
