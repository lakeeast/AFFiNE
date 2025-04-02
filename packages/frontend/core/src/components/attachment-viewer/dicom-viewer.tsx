import { useEffect, useRef, useState, forwardRef, ForwardedRef } from 'react';
import JSZip from 'jszip';
import type { PDFViewerProps } from './types';
import { getAttachmentBlob } from './utils';

export const DicomViewer = forwardRef(function DicomViewer(
  { model, ...props }: PDFViewerProps,
  ref: ForwardedRef<{ close: () => Promise<void> }>
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [webServerUrl, setWebServerUrl] = useState<string | undefined>(undefined);
  const modelRef = useRef(model);
  const cleanupResolveRef = useRef<((value?: unknown) => void) | null>(null);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    const isCloudFront = window.location.hostname.includes("docnosys.com");
    setWebServerUrl(isCloudFront ? `https://docnosys.com/qviewer` : "http://localhost:5478");
  }, []);

  const close = async () => {
    if (!iframeRef.current) return;

    try {
      // Send cleanup message and wait for response
      iframeRef.current.contentWindow?.postMessage({ type: 'cleanup' }, '*');
      
      console.log('Start waiting for clean up');
      // Wait for doneCleanup message
      await new Promise(resolve => {
        cleanupResolveRef.current = resolve;
      });

      console.log('Finish waiting for clean up');

      // Clean up iframe
      iframeRef.current.src = '';
      const parent = iframeRef.current.parentNode;
      if (parent) {
        const newIframe = document.createElement('iframe');
        parent.replaceChild(newIframe, iframeRef.current);
        iframeRef.current = newIframe;
      } else {
        iframeRef.current = null;
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      // Resolve anyway to prevent hanging if something goes wrong
      cleanupResolveRef.current?.();
    }
  };

  useEffect(() => {
    console.log('DicomViewer: Mounted, iframeRef.current:', iframeRef.current);
    if (ref) {
      if (typeof ref === 'function') {
        ref({ close });
      } else {
        ref.current = { close };
      }
    }

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
          const blobs = await Promise.all(
            Object.entries(zipFile.files)
              .filter(([fileName, file]) => !file.dir) // Ignore directories
              .map(async ([fileName, file]) => {
                const blob = await file.async('blob');
                (blob as any).name = fileName; // Manually attach name property
                return blob;
              })
          );
          console.log(`Sending to iFrame: with ${blobs.length} blobs`);
          const blobsWithMeta = blobs.map(blob => ({
            blob,
            name: (blob as any).name
          }));
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(blobsWithMeta, '*');
          }
          // Clear blobsWithMeta and blobs after sending
          blobsWithMeta.length = 0;
          blobs.length = 0;
        }
      } 
      else if (event.data.type === 'doneCleanup') {
          cleanupResolveRef.current?.();
          cleanupResolveRef.current = null;
      }
      else if (event.data.type === "appendFiles") {
        console.log("Received appendFiles message");
        const { files }: { files: File[] } = event.data;
        if (files && files.length > 0) {
          const parent = modelRef.current.parent;
          const originalName = modelRef.current.name;
          const originalCaption = modelRef.current.caption;
          const parentId = parent.id;

          const originalBlob = await getAttachmentBlob(modelRef.current);
          const zip = new JSZip();

          if (originalBlob) {
            const originalZip = await zip.loadAsync(originalBlob as any);
            await Promise.all(
              Object.entries(originalZip.files).map(async ([filename, file]) => {
                if (!file.dir) {
                  const blob = await file.async('blob');
                  zip.file(filename, blob);
                }
              })
            );
          }

          Array.from(files).forEach((file, index) => {
            const filename = file.name;
            zip.file(filename, file);
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
            caption: originalCaption,
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
      } else if (event.data.type === "removeFiles") {
        console.log("Received removeFiles message");
        const { file_names }: { file_names: string[] } = event.data;
        if (file_names && file_names.length > 0) {
          const parent = modelRef.current.parent;
          const originalName = modelRef.current.name;
          const originalCaption = modelRef.current.caption;
          const parentId = parent.id;

          const originalBlob = await getAttachmentBlob(modelRef.current);
          const newZip = new JSZip();

          if (originalBlob) {
            const originalZip = new JSZip();
            await originalZip.loadAsync(originalBlob as any);
            await Promise.all(
              Object.entries(originalZip.files).map(async ([filename, file]) => {
                if (!file.dir && !file_names.includes(filename)) {
                  const blob = await file.async('blob');
                  newZip.file(filename, blob);
                }
              })
            );
          }

          const updatedZipBlob = await newZip.generateAsync({ type: 'blob' });

          const oldSourceId = modelRef.current.sourceId;
          doc.deleteBlock(modelRef.current);
          if (oldSourceId) {
            await doc.blobSync.delete(oldSourceId);
          }

          const newSourceId = await doc.blobSync.set(updatedZipBlob);
          const newAttachmentProps = {
            name: originalName,
            size: updatedZipBlob.size,
            type: 'application/zip',
            sourceId: newSourceId,
            caption: originalCaption,
            embed: false,
            style: 'horizontalThin',
            index: modelRef.current.index,
            xywh: modelRef.current.xywh,
            lockedBySelf: false,
            rotate: 0,
          };

          const newBlockId = doc.addBlock('affine:attachment', newAttachmentProps, parentId);
          modelRef.current = doc.getBlockById(newBlockId) as any;

          console.log('Attachment replaced with updated ZIP (files removed)');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      cleanupResolveRef.current?.();
      console.log('DicomViewer: Unmounting, iframeRef.current:', iframeRef.current);
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
});