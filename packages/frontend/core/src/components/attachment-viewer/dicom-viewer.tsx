import { useEffect, useRef, useState } from 'react';

import type { PDFViewerProps } from './types';
import { getAttachmentBlob } from './utils';

export function DicomViewer({ model, ...props }: PDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [webServerUrl, setWebServerUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const isCloudFront = window.location.hostname.includes("docnosys.com");
    if (isCloudFront) {
      setWebServerUrl("https://dicom.docnosys.com/local");
    }
    else {
      setWebServerUrl("http://localhost:5555/local");
    }

    const fetchBlob = async () => {
      try {
        const fetchedBlob = await getAttachmentBlob(model);
        setBlob(fetchedBlob);
      } catch (error) {
        console.error('Error fetching blob:', error);
      }
    };

    fetchBlob().catch(console.error);

    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'ohifReady' && iframeRef.current && blob) {
        try {
          iframeRef.current.contentWindow?.postMessage([blob], '*');
        } catch (error) {
          console.error('Error sending blob to iFrame:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [model, blob]);

  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", height: "100%" }}>
  <h3>DICOM Viewer</h3>
  <iframe
    ref={iframeRef}
    src={webServerUrl}
    style={{ flex: 1, width: "100%", height: "100%", border: "none" }}
    title="DICOM Viewer"
  />
</div>
  );
}