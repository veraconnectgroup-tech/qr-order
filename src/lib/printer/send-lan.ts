import net from "node:net";

export async function sendLanPrintJob(
  ipAddress: string,
  port: number,
  data: Uint8Array,
  timeoutMs = 5000
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: ipAddress, port }, () => {
      socket.write(Buffer.from(data), (error) => {
        if (error) {
          reject(error);
          return;
        }
        socket.end();
      });
    });

    socket.setTimeout(timeoutMs);

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Printer connection timed out."));
    });

    socket.on("error", reject);

    socket.on("close", (hadError) => {
      if (!hadError) resolve();
    });
  });
}
