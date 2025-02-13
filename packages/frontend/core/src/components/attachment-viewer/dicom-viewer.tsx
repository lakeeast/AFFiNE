import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import type { PDFViewerProps } from './types';
import { getAttachmentBlob } from './utils';

export function DicomViewer({ model, ...props }: PDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [webServerUrl, setWebServerUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const isCloudFront = window.location.hostname.includes("docnosys.com");
    if (isCloudFront) {
      setWebServerUrl("https://dicom.docnosys.com/local");
    }
    else {
      setWebServerUrl("http://localhost:5555/local");
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'ohifReady') {
        try {
          const fetchedBlob = await getAttachmentBlob(model);
          // Unzip fetchedBlob
          const zip = new JSZip();
          const zipFile = await zip.loadAsync(fetchedBlob as any);
          // Prepare an array to hold the resulting Blobs
          const blobs: Blob[] = [];

          // Iterate over each file in the ZIP archive
          for (const [filename, file] of Object.entries(zip.files)) {
            // Extract the file as a Blob
            const fileBlob = await file.async('blob');
            blobs.push(fileBlob);
          }
          console.log('Sending blobs to iFrame:', blobs);
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
  }, [model]);

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