import type { AttachmentBlockModel } from '@blocksuite/affine/blocks';
import { useMemo, useEffect, forwardRef, ForwardedRef, useRef } from 'react';
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
    const model = useMemo(() => {
      const model = blocksuiteDoc?.getBlock(blockId)?.model;
      if (!model) return null;
      return model as AttachmentBlockModel;
    }, [blockId, blocksuiteDoc]);
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

    if (model === null) return null;

    return <AttachmentViewer model={model} ref={viewerRef} />;
  }
);