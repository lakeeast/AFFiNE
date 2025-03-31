import { forwardRef, ForwardedRef, useEffect, useRef } from 'react';
import { ViewBody, ViewHeader } from '@affine/core/modules/workbench';
import { DicomViewer } from './dicom-viewer';
import { AttachmentPreviewErrorBoundary, Error } from './error';
import { PDFViewer } from './pdf-viewer';
import * as styles from './styles.css';
import { Titlebar } from './titlebar';
import type { AttachmentViewerProps, PDFViewerProps } from './types';
import { buildAttachmentProps } from './utils';

export const AttachmentViewer = forwardRef(
  ({ model }: AttachmentViewerProps, ref: ForwardedRef<{ close?: () => Promise<void> }>) => {
    const props = buildAttachmentProps(model);
    const innerRef = useRef<{ close?: () => Promise<void> }>(null);

    const close = async () => {
      console.log('AttachmentViewer: close called');
      if (innerRef.current?.close) {
        await innerRef.current.close();
      }
    };

    useEffect(() => {
      console.log('AttachmentViewer: Mounted, model:', model.name);
      if (ref) {
        if (typeof ref === 'function') {
          ref({ close });
        } else {
          ref.current = { close };
        }
      }
      return () => {
        console.log('AttachmentViewer: Unmounting, model:', model.name);
      };
    }, [model, ref]);

    return (
      <div className={styles.viewerContainer}>
        <Titlebar {...props} />
        <AttachmentViewerInner {...props} ref={innerRef} />
      </div>
    );
  }
);

export const AttachmentViewerView = ({ model }: AttachmentViewerProps) => {
  const props = buildAttachmentProps(model);

  useEffect(() => {
    console.log('AttachmentViewerView: Mounted, model:', model.name);
    return () => {
      console.log('AttachmentViewerView: Unmounting, model:', model.name);
    };
  }, [model]);

  return (
    <>
      <ViewHeader>
        <Titlebar {...props} />
      </ViewHeader>
      <ViewBody>
        <AttachmentViewerInner {...props} />
      </ViewBody>
    </>
  );
};

const AttachmentViewerInner = forwardRef(
  (props: PDFViewerProps, ref: ForwardedRef<{ close?: () => Promise<void> }>) => {
    const { model } = props;
    const dicomViewerRef = useRef<{ close: () => Promise<void> }>(null);

    const close = async () => {
      console.log('AttachmentViewerInner: close called');
      if (dicomViewerRef.current?.close) {
        await dicomViewerRef.current.close();
      }
    };

    useEffect(() => {
      console.log('AttachmentViewerInner: Mounted, model:', model.name);
      if (ref) {
        if (typeof ref === 'function') {
          ref({ close });
        } else {
          ref.current = { close };
        }
      }
      return () => {
        console.log('AttachmentViewerInner: Unmounting, model:', model.name);
      };
    }, [model, ref]);

    if (model.type.endsWith('pdf')) {
      return (
        <AttachmentPreviewErrorBoundary>
          <PDFViewer {...props} />
        </AttachmentPreviewErrorBoundary>
      );
    } else if (model.name.endsWith('dicomdir')) {
      return (
        <AttachmentPreviewErrorBoundary>
          <DicomViewer {...props} ref={dicomViewerRef} />
        </AttachmentPreviewErrorBoundary>
      );
    } else {
      return <Error {...props} />;
    }
  }
);