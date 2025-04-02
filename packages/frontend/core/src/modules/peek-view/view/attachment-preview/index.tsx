import type { AttachmentBlockModel } from '@blocksuite/affine/blocks';
import { useEffect, forwardRef, ForwardedRef, useRef, useState } from 'react';
import { AttachmentViewer } from '../../../../components/attachment-viewer';
import { useEditor } from '../utils';

export type AttachmentPreviewModalProps = {
  docId: string;
  blockId: string;
};

export const AttachmentPreviewPeekView = forwardRef(
  ({ docId, blockId }: AttachmentPreviewModalProps, ref: ForwardedRef<{ close?: () => Promise<void> }>) => {
    const { doc } = useEditor(docId);
    const blocksuiteDoc = doc?.blockSuiteDoc;
    const [model, setModel] = useState<AttachmentBlockModel | null>(() => {
      const initialModel = blocksuiteDoc?.getBlock(blockId)?.model as AttachmentBlockModel;
      return initialModel || null;
    });
    const [currentBlockId, setCurrentBlockId] = useState(blockId); // Track the current blockId
    const viewerRef = useRef<{ close?: () => Promise<void> }>(null);

    useEffect(() => {
      console.log('AttachmentPreviewPeekView: Mounted, model:', model?.name);
      if (ref) {
        if (typeof ref === 'function') {
          ref({ close: viewerRef.current?.close });
        } else {
          ref.current = { close: viewerRef.current?.close };
        }
      }
      return () => {
        console.log('AttachmentPreviewPeekView: Unmounting, model:', model?.name);
      };
    }, [model, ref]);

    useEffect(() => {
      if (!blocksuiteDoc) {
        console.log('blocksuiteDoc not ready yet');
        return;
      }
      const updatedModel = blocksuiteDoc.getBlock(currentBlockId)?.model as AttachmentBlockModel;
      if (updatedModel && updatedModel !== model) {
        console.log('Updating model on mount or blocksuiteDoc change:', updatedModel.name, 'size:', updatedModel.size);
        setModel(updatedModel);
      } else if (!updatedModel) {
        console.log('No model found for blockId:', currentBlockId);
        setModel(null);
      }
    }, [blocksuiteDoc, currentBlockId, model]);

    useEffect(() => {
      const handleAttachmentUpdate = (event: CustomEvent) => {
        const { blockId: updatedBlockId, size } = event.detail;
        console.log('Event received, updatedBlockId:', updatedBlockId, 'currentBlockId:', currentBlockId, 'size:', size);
        
        // Always update to the new blockId from the event
        if (updatedBlockId !== currentBlockId) {
          console.log('Block ID changed from', currentBlockId, 'to', updatedBlockId);
          setCurrentBlockId(updatedBlockId);
        }

        const updatedModel = blocksuiteDoc?.getBlock(updatedBlockId)?.model as AttachmentBlockModel;
        if (updatedModel) {
          console.log('Attachment updated, new model:', updatedModel.name, 'size:', updatedModel.size);
          setModel(updatedModel);
        } else {
          console.log('No updated model found for blockId:', updatedBlockId);
        }
      };

      window.addEventListener('attachmentUpdated', handleAttachmentUpdate as EventListener);
      return () => {
        window.removeEventListener('attachmentUpdated', handleAttachmentUpdate as EventListener);
      };
    }, [blocksuiteDoc, currentBlockId]);

    if (!blocksuiteDoc || model === null) {
      console.log('Rendering loading state, blocksuiteDoc:', blocksuiteDoc, 'model:', model);
      return <div>Loading attachment...</div>;
    }

    return <AttachmentViewer model={model} ref={viewerRef} />;
  }
);