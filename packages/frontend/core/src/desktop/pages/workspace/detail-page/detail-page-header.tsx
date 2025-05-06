import {
  Divider,
  DragHandle,
  type InlineEditHandle,
  observeResize,
  useDraggable,
} from '@affine/component';
import { SharePageButton } from '@affine/core/components/affine/share-page-modal';
import { FavoriteButton } from '@affine/core/components/blocksuite/block-suite-header/favorite';
import { InfoButton } from '@affine/core/components/blocksuite/block-suite-header/info';
import { JournalWeekDatePicker } from '@affine/core/components/blocksuite/block-suite-header/journal/date-picker';
import { JournalTodayButton } from '@affine/core/components/blocksuite/block-suite-header/journal/today-button';
import { PageHeaderMenuButton } from '@affine/core/components/blocksuite/block-suite-header/menu';
import { DetailPageHeaderPresentButton } from '@affine/core/components/blocksuite/block-suite-header/present/detail-header-present-button';
import { BlocksuiteHeaderTitle } from '@affine/core/components/blocksuite/block-suite-header/title';
import { EditorModeSwitch } from '@affine/core/components/blocksuite/block-suite-mode-switch';
import { useRegisterCopyLinkCommands } from '@affine/core/components/hooks/affine/use-register-copy-link-commands';
import { HeaderDivider } from '@affine/core/components/pure/header';
import { DocService } from '@affine/core/modules/doc';
import { DocDisplayMetaService } from '@affine/core/modules/doc-display-meta';
import { EditorService } from '@affine/core/modules/editor';
import { JournalService } from '@affine/core/modules/journal';
import { TemplateDocService } from '@affine/core/modules/template-doc';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { ViewIcon, ViewTitle } from '@affine/core/modules/workbench';
import type { Workspace } from '@affine/core/modules/workspace';
import type { AffineDNDData } from '@affine/core/types/dnd';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import type { Store } from '@blocksuite/affine/store';
import { ZipTransformer } from '@blocksuite/affine/blocks';
import type { DocSnapshot } from '@blocksuite/affine/store';
import { replaceIdMiddleware, titleMiddleware } from '@blocksuite/blocks';
import { getAssetName, Transformer } from '@blocksuite/store';
import { useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import {
  forwardRef,
  type HTMLAttributes,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StorageManager } from './storage-manager'; // Adjust path as needed
import { useDetailPageHeaderResponsive } from './use-header-responsive';

import { Zip } from '../../../../../../../../blocksuite/blocks/src/_common/transformers/utils';
import * as styles from './detail-page-header.css.ts';

const Header = forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }
>(({ children, style, className }, ref) => {
  return (
    <div data-testid="header" style={style} className={className} ref={ref}>
      {children}
    </div>
  );
});

Header.displayName = 'forwardRef(Header)';

const TemplateMark = memo(function TemplateMark({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const t = useI18n();
  const doc = useService(DocService).doc;
  const templateDocService = useService(TemplateDocService);
  const isTemplate = useLiveData(templateDocService.list.isTemplate$(doc.id));

  if (!isTemplate) return null;

  return (
    <div className={clsx(styles.templateMark, className)} {...props}>
      {t['Template']()}
    </div>
  );
});

interface PageHeaderProps {
  page: Store;
  workspace: Workspace;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function JournalPageHeader({ page, workspace, onSave, isSaving }: PageHeaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    return observeResize(container, entry => {
      setContainerWidth(entry.contentRect.width);
    });
  }, []);

  const { hideShare, hideToday } = useDetailPageHeaderResponsive(containerWidth);

  const docDisplayMetaService = useService(DocDisplayMetaService);
  const i18n = useI18n();
  const title = i18n.t(useLiveData(docDisplayMetaService.title$(page.id)));

  return (
    <Header className={styles.header} ref={containerRef}>
      <ViewTitle title={title} />
      <ViewIcon icon="journal" />
      <EditorModeSwitch />
      <div className={styles.journalWeekPicker}>
        <JournalWeekDatePicker page={page} />
      </div>
      <TemplateMark className={styles.journalTemplateMark} />
      {hideToday ? null : <JournalTodayButton />}
      <HeaderDivider />
      <PageHeaderMenuButton isJournal page={page} containerWidth={containerWidth} />
      {page && !hideShare ? <SharePageButton workspace={workspace} page={page} /> : null}
      <button
        className={clsx(styles.saveButton, { [styles.saveButtonLoading]: isSaving })}
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </Header>
  );
}

export function NormalPageHeader({ page, workspace, onSave, isSaving }: PageHeaderProps) {
  const titleInputHandleRef = useRef<InlineEditHandle>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    return observeResize(container, entry => {
      setContainerWidth(entry.contentRect.width);
    });
  }, []);

  const { hideCollect, hideShare, hidePresent, showDivider } =
    useDetailPageHeaderResponsive(containerWidth);

  const onRename = useCallback(() => {
    setTimeout(
      () => titleInputHandleRef.current?.triggerEdit(),
      500 /* wait for menu animation end */
    );
  }, []);

  const docDisplayMetaService = useService(DocDisplayMetaService);
  const i18n = useI18n();
  const title = i18n.t(useLiveData(docDisplayMetaService.title$(page.id)));

  const editor = useService(EditorService).editor;
  const currentMode = useLiveData(editor.mode$);

  return (
    <Header className={styles.header} ref={containerRef}>
      <ViewTitle title={title} />
      <ViewIcon icon={currentMode ?? 'page'} />
      <EditorModeSwitch />
      <BlocksuiteHeaderTitle docId={page.id} inputHandleRef={titleInputHandleRef} />
      <TemplateMark />
      <div className={styles.iconButtonContainer}>
        {hideCollect ? null : (
          <>
            <FavoriteButton pageId={page?.id} />
            <InfoButton docId={page.id} />
            <PageHeaderMenuButton
              rename={onRename}
              page={page}
              containerWidth={containerWidth}
            />
          </>
        )}
      </div>
      <div className={styles.spacer} />
      {!hidePresent ? <DetailPageHeaderPresentButton /> : null}
      {page && !hideShare ? <SharePageButton workspace={workspace} page={page} /> : null}
      {showDivider ? (
        <Divider orientation="vertical" style={{ height: 20, marginLeft: 4 }} />
      ) : null}
      <button
        className={clsx(styles.saveButton, { [styles.saveButtonLoading]: isSaving })}
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </Header>
  );
}

export function DetailPageHeader(
  props: PageHeaderProps & {
    onDragging?: (dragging: boolean) => void;
  }
) {
  const { page, workspace, onDragging } = props;
  const journalService = useService(JournalService);
  const isJournal = !!useLiveData(journalService.journalDate$(page.id));
  const isInTrash = page.meta?.trash;

  useRegisterCopyLinkCommands({
    workspaceMeta: workspace.meta,
    docId: page.id,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async (workspace: Workspace, page: Store) => {
    console.log('Initiating save operation for page:', page.id);
    setIsSaving(true);

    try {
      // Set up listener for save message first
      const savePromise = new Promise<any>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          if (event.data.type === 'save' && event.data.saveCredentials) {
            console.log('Received save message with credentials:', event.data.saveCredentials);
            resolve(event.data.saveCredentials);
            window.removeEventListener('message', handler);
          }
        };
        window.addEventListener('message', handler);
        // Timeout to prevent hanging
        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Timeout waiting for save credentials'));
        }, 10000); // 10 seconds
      });

      // Send request-save message after listener is set
      window.parent.postMessage(
        {
          type: 'request-save',
          documentType: 'doc',
        },
        '*'
      );
      console.log('Sent request-save message');

      // Wait for saveCredentials
      const saveCredentials = await savePromise;

      // Create snapshot using original logic
      const workspaceImpl = page.workspace;
      const docs = [page];
      const zip = new Zip();
      const job = new Transformer({
        schema: workspaceImpl.schema,
        blobCRUD: workspaceImpl.blobSync,
        docCRUD: {
          create: (id: string) => workspaceImpl.createDoc({ id }),
          get: (id: string) => workspaceImpl.getDoc(id),
          delete: (id: string) => workspaceImpl.removeDoc(id),
        },
        middlewares: [
          replaceIdMiddleware(workspaceImpl.idGenerator),
          titleMiddleware(workspaceImpl.meta.docMetas),
        ],
      });
      const snapshots = await Promise.all(docs.map(job.docToSnapshot));

      await Promise.all(
        snapshots
          .filter((snapshot): snapshot is DocSnapshot => !!snapshot)
          .map(async snapshot => {
            const snapshotName = `${snapshot.meta.title || 'untitled'}.snapshot.json`;
            await zip.file(snapshotName, JSON.stringify(snapshot, null, 2));
          })
      );

      const assets = zip.folder('assets');
      const pathBlobIdMap = job.assetsManager.getPathBlobIdMap();
      const assetsMap = job.assets;

      await Promise.all(
        Array.from(pathBlobIdMap.values()).map(async blobId => {
          await job.assetsManager.readFromBlob(blobId);
          const ext = getAssetName(assetsMap, blobId).split('.').at(-1);
          const blob = assetsMap.get(blobId);
          if (blob) {
            await assets.file(`${blobId}.${ext}`, blob);
          }
        })
      );

      const snapshotBlob = await zip.generate();

      // Initialize StorageManager and upload
      const storage = StorageManager.CreateStorage(saveCredentials.storageType);
      storage.initialize(saveCredentials);

      const snapshotName = `affine.zip`;
      await storage.uploadFile(snapshotBlob, snapshotName, null);
      console.log('Snapshot saved to cloud storage:', snapshotName);
    } catch (error) {
      console.error('Error saving snapshot:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const onSave = useCallback(() => handleSave(workspace, page), [handleSave, workspace, page]);

  const { dragRef, dragging, CustomDragPreview } = useDraggable<AffineDNDData>(
    () => {
      return {
        data: {
          from: {
            at: 'doc-detail:header',
            docId: page.id,
          },
          entity: {
            type: 'doc',
            id: page.id,
          },
        },
        canDrag: args => {
          const editingElement =
            args.element.contains(document.activeElement) &&
            document.activeElement?.tagName === 'INPUT';
          return !editingElement;
        },
        onDragStart: () => {
          track.$.header.$.dragStart();
        },
        dragPreviewPosition: 'pointer-outside',
      };
    },
    [page.id]
  );

  useEffect(() => {
    onDragging?.(dragging);
  }, [dragging, onDragging]);

  const inner = isJournal && !isInTrash ? (
    <JournalPageHeader page={page} workspace={workspace} onSave={onSave} isSaving={isSaving} />
  ) : (
    <NormalPageHeader page={page} workspace={workspace} onSave={onSave} isSaving={isSaving} />
  );

  return (
    <>
      <div className={styles.root} ref={dragRef} data-dragging={dragging}>
        <DragHandle dragging={dragging} className={styles.dragHandle} />
        {inner}
      </div>
      <CustomDragPreview>
        <div className={styles.dragPreview}>{inner}</div>
      </CustomDragPreview>
    </>
  );
}