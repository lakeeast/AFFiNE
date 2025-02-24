import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import type { PDFViewerProps } from './types';
import { getAttachmentBlob } from './utils';

export function DicomViewer({ model, ...props }: PDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [webServerUrl, setWebServerUrl] = useState<string | undefined>(undefined);
  const modelRef = useRef(model);

  // Update modelRef whenever model changes
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    const isCloudFront = window.location.hostname.includes("docnosys.com");
    setWebServerUrl(isCloudFront ? `${window.location.origin}/ohif/local?v=0` : "http://localhost:5555/local?v=0");
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Ignore messages from setImmediate in polyfill.js
      if (typeof event.data === "string" && event.data.startsWith("setImmediate$")) {
        return;
      }

      if (event.data.type === 'ohifReady') {
        try {
          const fetchedBlob = await getAttachmentBlob(modelRef.current);
          const zip = new JSZip();
          const zipFile = await zip.loadAsync(fetchedBlob as any);

          const blobs: Blob[] = await Promise.all(
            Object.values(zip.files).map(file => file.async('blob'))
          );

          console.log(`Sending to iFrame: with ${blobs.length} blobs`);
          iframeRef?.current?.contentWindow?.postMessage(blobs, '*');
        } catch (error) {
          console.error('Error sending blob to iFrame:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []); // Only run once when the component mounts

  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", height: "100%" }}>
      <iframe
        ref={iframeRef}
        src={webServerUrl}
        style={{ flex: 1, width: "100%", height: "100%", border: "none" }}
        title="DICOM Viewer"
      />
    </div>
  );
}