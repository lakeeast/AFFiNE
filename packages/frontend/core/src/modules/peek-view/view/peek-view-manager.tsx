import { toReactNode } from '@affine/component';
import { AIChatBlockPeekViewTemplate } from '@affine/core/blocksuite/presets/ai';
import { BlockComponent } from '@blocksuite/block-std';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useMemo, useRef } from 'react';

import type { ActivePeekView } from '../entities/peek-view';
import { PeekViewService } from '../services/peek-view';
import { AttachmentPreviewPeekView } from './attachment-preview';
import { DocPeekPreview } from './doc-preview';
import { ImagePreviewPeekView } from './image-preview';
import {
  PeekViewModalContainer,
  type PeekViewModalContainerProps,
} from './modal-container';
import {
  AttachmentPeekViewControls,
  DefaultPeekViewControls,
  DocPeekViewControls,
} from './peek-view-controls';

function renderPeekView(
  { info }: ActivePeekView,
  peekViewRef: React.MutableRefObject<{ close?: () => Promise<void> } | null>
) {
  if (info.type === 'template') {
    return toReactNode(info.template);
  }
  if (info.type === 'doc') {
    return <DocPeekPreview docRef={info.docRef} />;
  }
  if (info.type === 'attachment' && info.docRef.blockIds?.[0]) {
    return (
      <AttachmentPreviewPeekView
        docId={info.docRef.docId}
        blockId={info.docRef.blockIds[0]}
        ref={peekViewRef}
      />
    );
  }
  if (info.type === 'image' && info.docRef.blockIds?.[0]) {
    return (
      <ImagePreviewPeekView
        docId={info.docRef.docId}
        blockId={info.docRef.blockIds[0]}
      />
    );
  }
  if (info.type === 'ai-chat-block') {
    const template = AIChatBlockPeekViewTemplate(info.model, info.host);
    return toReactNode(template);
  }
  return null; // unreachable
}

const renderControls = (
  { info }: ActivePeekView,
  peekViewRef?: React.MutableRefObject<{ close?: () => Promise<void> } | null>
) => {
  if (info.type === 'doc') {
    return <DocPeekViewControls docRef={info.docRef} />;
  }
  if (info.type === 'attachment') {
    return <AttachmentPeekViewControls docRef={info.docRef} viewerRef={peekViewRef} />;
  }
  if (info.type === 'image') {
    return null; // image controls are rendered in the image preview
  }
  return <DefaultPeekViewControls />;
};

const getMode = (info: ActivePeekView['info']) => {
  if (info.type === 'image') {
    return 'full';
  }
  return 'fit';
};

const getRendererProps = (
  activePeekView?: ActivePeekView,
  peekViewRef?: React.MutableRefObject<{ close?: () => Promise<void> } | null>
): Partial<PeekViewModalContainerProps> | undefined => {
  if (!activePeekView) {
    return;
  }

  const preview = renderPeekView(activePeekView, peekViewRef!);
  const controls = renderControls(activePeekView, peekViewRef);
  return {
    children: preview,
    controls,
    target:
      activePeekView?.target.element instanceof HTMLElement
        ? activePeekView.target.element
        : undefined,
    mode: getMode(activePeekView.info),
    animation:
      activePeekView.target.element && getMode(activePeekView.info) !== 'full'
        ? 'zoom'
        : 'fade',
    dialogFrame: activePeekView.info.type !== 'image',
  };
};

export const PeekViewManagerModal = () => {
  const peekViewEntity = useService(PeekViewService).peekView;
  const activePeekView = useLiveData(peekViewEntity.active$);
  const show = useLiveData(peekViewEntity.show$);
  const peekViewRef = useRef<{ close?: () => Promise<void> } | null>(null);

  const renderProps = useMemo(() => {
    if (!activePeekView) {
      return;
    }
    console.log('PeekViewManagerModal: Rendering with activePeekView, peekViewRef.current:', peekViewRef.current);
    return getRendererProps(activePeekView, peekViewRef);
  }, [activePeekView]);

  useEffect(() => {
    console.log('PeekViewManagerModal: Mounted, peekViewRef.current:', peekViewRef.current);
    const subscription = peekViewEntity.show$.subscribe(() => {
      if (activePeekView?.target.element instanceof BlockComponent) {
        activePeekView.target.element.requestUpdate();
      }
    });
    return () => {
      console.log('PeekViewManagerModal: Unmounting, peekViewRef.current:', peekViewRef.current);
      subscription.unsubscribe();
    };
  }, [activePeekView, peekViewEntity]);

  return (
    <PeekViewModalContainer
      {...renderProps}
      animation={show?.animation ? renderProps?.animation : 'none'}
      open={!!show?.value && !!renderProps}
      onOpenChange={open => !open && peekViewEntity.close()}
    >
      {renderProps?.children}
    </PeekViewModalContainer>
  );
};