// const EXTENSION_ID = "your_chrome_extension_id_here";

// export async function checkExtensionInstalled(): Promise<boolean> {
//   if (typeof window === "undefined" || !window.chrome?.runtime?.sendMessage) {
//     return false;
//   }

//   return new Promise((resolve) => {
//     try {
//       window.chrome.runtime.sendMessage(
//         EXTENSION_ID,
//         { type: "getStatus" },
//         (response) => {
//           if (window.chrome.runtime.lastError || !response) {
//             resolve(false); // Extension not installed or inactive
//           } else {
//             resolve(response.installed === true);
//           }
//         }
//       );
//     } catch {
//       resolve(false);
//     }
//   });
// }