"use client";

const USB_PAIRING_KEY = "escpos-usb-pairing";

export type UsbPairingInfo = {
  vendorId: number;
  productId: number;
  productName?: string;
};

/** Common ESC/POS thermal printer vendors (Epson, Star, Bixolon, etc.) */
export const ESCPOS_USB_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x04b8 },
  { vendorId: 0x0519 },
  { vendorId: 0x154f },
  { vendorId: 0x0fe6 },
  { vendorId: 0x0483 },
];

function pairingStorageKey(printerId: string) {
  return `${USB_PAIRING_KEY}:${printerId}`;
}

export function saveUsbPairing(printerId: string, device: USBDevice) {
  const info: UsbPairingInfo = {
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName,
  };
  localStorage.setItem(pairingStorageKey(printerId), JSON.stringify(info));
}

export function loadUsbPairing(printerId: string): UsbPairingInfo | null {
  const raw = localStorage.getItem(pairingStorageKey(printerId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsbPairingInfo;
  } catch {
    return null;
  }
}

export function clearUsbPairing(printerId: string) {
  localStorage.removeItem(pairingStorageKey(printerId));
}

export async function requestUsbDevice(): Promise<USBDevice | null> {
  if (!navigator.usb) {
    throw new Error("WebUSB is not supported in this browser.");
  }

  return navigator.usb.requestDevice({ filters: ESCPOS_USB_FILTERS });
}

async function openUsbDevice(
  pairing: UsbPairingInfo
): Promise<USBDevice | null> {
  if (!navigator.usb) return null;

  const devices = await navigator.usb.getDevices();
  return (
    devices.find(
      (device) =>
        device.vendorId === pairing.vendorId &&
        device.productId === pairing.productId
    ) ?? null
  );
}

async function connectUsbDevice(device: USBDevice): Promise<USBDevice> {
  if (!device.opened) {
    await device.open();
  }

  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  const iface = device.configuration?.interfaces[0];
  if (!iface) {
    throw new Error("No USB interface found on printer.");
  }

  if (!iface.claimed) {
    await device.claimInterface(iface.interfaceNumber);
  }

  const endpoint = iface.alternate?.endpoints.find(
    (ep) => ep.direction === "out"
  );

  if (!endpoint) {
    throw new Error("No USB OUT endpoint found on printer.");
  }

  return device;
}

export async function sendToUsb(
  data: Uint8Array,
  printerId: string
): Promise<void> {
  const pairing = loadUsbPairing(printerId);
  if (!pairing) {
    throw new Error("USB printer is not paired. Connect it in settings first.");
  }

  let device = await openUsbDevice(pairing);
  if (!device) {
    throw new Error("Paired USB printer not found. Reconnect the device.");
  }

  device = await connectUsbDevice(device);

  const iface = device.configuration!.interfaces[0];
  const endpoint = iface.alternate!.endpoints.find(
    (ep) => ep.direction === "out"
  )!;

  await device.transferOut(endpoint.endpointNumber, data as BufferSource);
}

export async function pairUsbPrinter(
  printerId: string
): Promise<UsbPairingInfo> {
  const device = await requestUsbDevice();
  if (!device) {
    throw new Error("No USB printer selected.");
  }

  saveUsbPairing(printerId, device);
  return loadUsbPairing(printerId)!;
}
