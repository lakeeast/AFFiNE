import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import type { PDFViewerProps } from './types';
import { getAttachmentBlob } from './utils';

export function DicomViewer({ model, ...props }: PDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [webServerUrl, setWebServerUrl] = useState<string | undefined>(undefined);
  const modelRef = useRef(model);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    const isCloudFront = window.location.hostname.includes("docnosys.com");
    setWebServerUrl(isCloudFront ? `${window.location.origin}/qviewer` : "http://localhost:5478");
  }, []);

  useEffect(() => {
    const doc = modelRef.current.doc;
    const handleMessage = async (event: MessageEvent) => {
      if (typeof event.data === "string" && event.data.startsWith("setImmediate$")) {
        return;
      }

      if (event.data.type === 'ohifReady') {
        const fetchedBlob = await getAttachmentBlob(modelRef.current);
        if (fetchedBlob) {
          const zip = new JSZip();
          const zipFile = await zip.loadAsync(fetchedBlob as any);
          const blobs: Blob[] = await Promise.all(
            Object.values(zip.files).map(file => file.async('blob'))
          );
          console.log(`Sending to iFrame: with ${blobs.length} blobs`);
          iframeRef?.current?.contentWindow?.postMessage(blobs, '*');
        }
      } else if (event.data.type === "appendFiles") {
        console.log("Received appendFiles message");
        const { files }: { files: File[] } = event.data;
        if (files && files.length > 0) {
          const parent = modelRef.current.parent;
          const originalName = modelRef.current.name;
          const parentId = parent.id;

          const originalBlob = await getAttachmentBlob(modelRef.current);
          const zip = new JSZip();
          if (originalBlob) {
            const originalZip = await zip.loadAsync(originalBlob as any);
            for (const [filename, file] of Object.entries(originalZip.files)) {
              if (!file.dir) {
                zip.file(filename, await file.async('blob'));
              }
            }
          }

          files.forEach((file, index) => {
            zip.file(file.name || `file-${index}`, file);
          });

          const combinedZipBlob = await zip.generateAsync({ type: 'blob' });

          const oldSourceId = modelRef.current.sourceId;
          doc.deleteBlock(modelRef.current);
          if (oldSourceId) {
            await doc.blobSync.delete(oldSourceId);
          }

          const newSourceId = await doc.blobSync.set(combinedZipBlob);
          const newAttachmentProps = {
            name: originalName,
            size: combinedZipBlob.size,
            type: 'application/zip',
            sourceId: newSourceId,
            embed: false,
            style: 'horizontalThin',
            index: modelRef.current.index,
            xywh: modelRef.current.xywh,
            lockedBySelf: false,
            rotate: 0,
          };

          const newBlockId = doc.addBlock('affine:attachment', newAttachmentProps, parentId);
          modelRef.current = doc.getBlockById(newBlockId) as any;

          console.log('Attachment replaced with combined ZIP');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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