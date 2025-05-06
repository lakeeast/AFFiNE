import { Scrollable } from '@affine/component';
import { PageDetailSkeleton } from '@affine/component/page-detail-skeleton';
import type { ChatPanel } from '@affine/core/blocksuite/presets/ai';
import { AIProvider } from '@affine/core/blocksuite/presets/ai';
import { PageAIOnboarding } from '@affine/core/components/affine/ai-onboarding';
import { EditorOutlineViewer } from '@affine/core/components/blocksuite/outline-viewer';
import { DocPropertySidebar } from '@affine/core/components/doc-properties/sidebar';
import { useAppSettingHelper } from '@affine/core/components/hooks/affine/use-app-setting-helper';
import { useDocMetaHelper } from '@affine/core/components/hooks/use-block-suite-page-meta';
import { DocService } from '@affine/core/modules/doc';
import { DocsService } from '@affine/core/modules/doc';
import { EditorService } from '@affine/core/modules/editor';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { GlobalContextService } from '@affine/core/modules/global-context';
import { PeekViewService } from '@affine/core/modules/peek-view';
import { RecentDocsService } from '@affine/core/modules/quicksearch';
import { ViewService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { isNewTabTrigger } from '@affine/core/utils';
import onboardingUrl from '@affine/templates/onboarding.zip';
import track from '@affine/track';
import { RefNodeSlotsProvider } from '@blocksuite/affine/blocks';
import { ZipTransformer } from '@blocksuite/affine/blocks';
import {
  type Disposable,
  DisposableGroup,
} from '@blocksuite/affine/global/utils';
import { type AffineEditorContainer } from '@blocksuite/affine/presets';
import {
  AiIcon,
  FrameIcon,
  PropertyIcon,
  TocIcon,
  TodayIcon,
} from '@blocksuite/icons/rc';
import {
  FrameworkScope,
  useLiveData,
  useService,
  useServices,
} from '@toeverything/infra';
import clsx from 'clsx';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AffineErrorBoundary } from '../../../../components/affine/affine-error-boundary';
import { GlobalPageHistoryModal } from '../../../../components/affine/page-history-modal';
import { useRegisterBlocksuiteEditorCommands } from '../../../../components/hooks/affine/use-register-blocksuite-editor-commands';
import { useActiveBlocksuiteEditor } from '../../../../components/hooks/use-block-suite-editor';
import { usePageDocumentTitle } from '../../../../components/hooks/use-global-state';
import { PageDetailEditor } from '../../../../components/page-detail-editor';
import { TrashPageFooter } from '../../../../components/pure/trash-page-footer';
import {
  useIsActiveView,
  ViewBody,
  ViewHeader,
  ViewSidebarTab,
  WorkbenchService,
} from '../../../../modules/workbench';
import { PageNotFound } from '../../404';
import * as styles from './detail-page.css';
import { DetailPageHeader } from './detail-page-header';
import { DetailPageWrapper } from './detail-page-wrapper';
import { EditorChatPanel } from './tabs/chat';
import { EditorFramePanel } from './tabs/frame';
import { EditorJournalPanel } from './tabs/journal';
import { EditorOutlinePanel } from './tabs/outline';

// Hook to import onboarding document if pageId doesn't exist
const useImportOnboardingDoc = (pageId: string) => {
  const workspaceService = useService(WorkspaceService);
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [resolvedPageId, setResolvedPageId] = useState<string | null>(null);

  useEffect(() => {
    const checkAndImport = async () => {
      console.log('Checking document for pageId:', pageId);
      const workspace = workspaceService.workspace;
      if (!workspace) {
        console.error('No workspace available');
        setStatus('error');
        return;
      }
      const docCollection = workspace.docCollection;

      // Check if document exists
      const docExists = docCollection.getDoc(pageId);
      console.log('Document exists:', !!docExists, 'pageId:', pageId);
      if (docExists) {
        setStatus('success');
        setResolvedPageId(pageId);
        return;
      }

      setStatus('loading');
      console.log('Document not found, importing onboarding template with pageId:', pageId);

      try {
        console.log('Fetching onboarding URL:', onboardingUrl);
        const blob = await (await fetch(onboardingUrl)).blob();
        console.log('Onboarding ZIP fetched, importing with pageId:', pageId);
        await ZipTransformer.importDocs(docCollection, blob);
        console.log('Onboarding template imported');

        // Wait for doc readiness
        await workspace.engine.doc.waitForDocReady(workspace.id);
        console.log('Workspace docs ready');

        // Find the imported document
        const docsService = workspace.scope.get(DocsService);
        const docs = docsService.list.docs$.value;
        console.log('Available documents:', docs.map(doc => ({ id: doc.id, title: doc.title$.value })));
        const importedDoc = docs.find(p => p.id === pageId);

        if (importedDoc) {
          console.log('Imported document found:', importedDoc.id, 'Title:', importedDoc.title$.value);
          // Log document blocks to inspect structure
          console.log('Document blocks:', importedDoc.blockSuiteDoc.blocks.map(block => block.flavour));
          // Set to page mode for new IDs
          importedDoc.setPrimaryMode('page');
          setResolvedPageId(importedDoc.id);
          setStatus('success');
        } else {
          console.error('Imported document not found for pageId:', pageId);
          // Fallback to first document if multiple are imported
          const fallbackDoc = docs[0];
          if (fallbackDoc) {
            console.log('Falling back to first document:', fallbackDoc.id, 'Title:', fallbackDoc.title$.value);
            console.log('Fallback document blocks:', fallbackDoc.blockSuiteDoc.blocks.map(block => block.flavour));
            fallbackDoc.setPrimaryMode('page');
            setResolvedPageId(fallbackDoc.id);
            setStatus('success');
            navigate(`/workspace/local_workspace/${fallbackDoc.id}`, { replace: true });
          } else {
            throw new Error('Imported document not found');
          }
        }
      } catch (error) {
        console.error('Error importing onboarding document:', error);
        setStatus('error');
      }
    };

    if (pageId) {
      checkAndImport();
    } else {
      console.log('Skipping checkAndImport due to missing pageId');
      setStatus('error');
    }
  }, [workspaceService, pageId, navigate]);

  return { status, resolvedPageId };
};

const DetailPageImpl = memo(function DetailPageImpl() {
  const {
    workbenchService,
    viewService,
    editorService,
    docService,
    workspaceService,
    globalContextService,
    featureFlagService,
  } = useServices({
    WorkbenchService,
    ViewService,
    EditorService,
    DocService,
    WorkspaceService,
    GlobalContextService,
    FeatureFlagService,
  });
  const workbench = workbenchService.workbench;
  const editor = editorService.editor;
  const view = viewService.view;
  const workspace = workspaceService.workspace;
  const globalContext = globalContextService.globalContext;
  const doc = docService.doc;

  const mode = useLiveData(editor.mode$);
  const activeSidebarTab = useLiveData(view.activeSidebarTab$);

  const isInTrash = useLiveData(doc.meta$.map(meta => meta.trash));
  const editorContainer = useLiveData(editor.editorContainer$);

  const isSideBarOpen = useLiveData(workbench.sidebarOpen$);
  const { appSettings } = useAppSettingHelper();
  const chatPanelRef = useRef<ChatPanel | null>(null);
  const { setDocReadonly } = useDocMetaHelper();

  const peekView = useService(PeekViewService).peekView;

  const isActiveView = useIsActiveView();
  // TODO(@eyhn): remove jotai here
  const [_, setActiveBlockSuiteEditor] = useActiveBlocksuiteEditor();

  const enableAI = false; // featureFlagService.flags.enable_ai.value;

  useEffect(() => {
    if (isActiveView) {
      setActiveBlockSuiteEditor(editorContainer);
    }
  }, [editorContainer, isActiveView, setActiveBlockSuiteEditor]);

  useEffect(() => {
    const disposables: Disposable[] = [];
    const openHandler = () => {
      workbench.openSidebar();
      view.activeSidebarTab('chat');
    };
    disposables.push(AIProvider.slots.requestOpenWithChat.on(openHandler));
    disposables.push(AIProvider.slots.requestSendWithChat.on(openHandler));
    return () => disposables.forEach(d => d.dispose());
  }, [activeSidebarTab, view, workbench]);

  useEffect(() => {
    if (isActiveView) {
      globalContext.docId.set(doc.id);
      globalContext.isDoc.set(true);

      return () => {
        globalContext.docId.set(null);
        globalContext.isDoc.set(false);
      };
    }
    return;
  }, [doc, globalContext, isActiveView]);

  useEffect(() => {
    if (isActiveView) {
      globalContext.docMode.set(mode);

      return () => {
        globalContext.docMode.set(null);
      };
    }
    return;
  }, [doc, globalContext, isActiveView, mode]);

  useEffect(() => {
    if ('isMobile' in environment && environment.isMobile) {
      setDocReadonly(doc.id, true);
    }
  }, [doc.id, setDocReadonly]);

  useEffect(() => {
    if (isActiveView) {
      globalContext.isTrashDoc.set(!!isInTrash);

      return () => {
        globalContext.isTrashDoc.set(null);
      };
    }
    return;
  }, [globalContext, isActiveView, isInTrash]);

  useRegisterBlocksuiteEditorCommands(editor, isActiveView);
  const title = useLiveData(doc.title$);
  usePageDocumentTitle(title);

  const onLoad = useCallback(
    (editorContainer: AffineEditorContainer) => {
      // blocksuite editor host
      const editorHost = editorContainer.host;

      const std = editorHost?.std;
      const disposable = new DisposableGroup();
      if (std) {
        const refNodeSlots = std.getOptional(RefNodeSlotsProvider);
        if (refNodeSlots) {
          disposable.add(
            // the event should not be emitted by AffineReference
            refNodeSlots.docLinkClicked.on(
              ({ pageId, params, openMode, event, host }) => {
                if (host !== editorHost) {
                  return;
                }
                openMode ??=
                  event && isNewTabTrigger(event)
                    ? 'open-in-new-tab'
                    : 'open-in-active-view';

                if (openMode === 'open-in-new-view') {
                  track.doc.editor.toolbar.openInSplitView();
                } else if (openMode === 'open-in-center-peek') {
                  track.doc.editor.toolbar.openInPeekView();
                } else if (openMode === 'open-in-new-tab') {
                  track.doc.editor.toolbar.openInNewTab();
                }

                if (openMode !== 'open-in-center-peek') {
                  const at = (() => {
                    if (openMode === 'open-in-active-view') {
                      return 'active';
                    }
                    // split view is only supported on electron
                    if (openMode === 'open-in-new-view') {
                      return BUILD_CONFIG.isElectron ? 'tail' : 'new-tab';
                    }
                    if (openMode === 'open-in-new-tab') {
                      return 'new-tab';
                    }
                    return 'active';
                  })();
                  workbench.openDoc(
                    {
                      docId: pageId,
                      blockIds: params?.blockIds,
                      elementIds: params?.elementIds,
                    },
                    {
                      at: at,
                      show: true,
                    }
                  );
                } else {
                  peekView
                    .open({
                      docRef: {
                        docId: pageId,
                      },
                      ...params,
                    })
                    .catch(console.error);
                }
              }
            )
          );
        }
      }

      const unbind = editor.bindEditorContainer(
        editorContainer,
        (editorContainer as any).docTitle, // set from proxy
        scrollViewportRef.current
      );

      // Post message to parent window to indicate document is loaded
      window.parent.postMessage(
        {
          type: 'url-changed',
          payload: doc.id
        },
        '*'
      );

      return () => {
        unbind();
        disposable.dispose();
      };
    },
    [editor, workbench, peekView, doc.id]
  );

  const [hasScrollTop, setHasScrollTop] = useState(false);

  const openOutlinePanel = useCallback(() => {
    workbench.openSidebar();
    view.activeSidebarTab('outline');
  }, [workbench, view]);

  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;

    const hasScrollTop = scrollTop > 0;
    setHasScrollTop(hasScrollTop);
  }, []);

  const [dragging, setDragging] = useState(false);

  return (
    <FrameworkScope scope={editor.scope}>
      <ViewHeader>
        <DetailPageHeader
          page={doc.blockSuiteDoc}
          workspace={workspace}
          onDragging={setDragging}
        />
      </ViewHeader>
      <ViewBody>
        <div
          className={styles.mainContainer}
          data-dynamic-top-border={BUILD_CONFIG.isElectron}
          data-has-scroll-top={hasScrollTop}
        >
          <AffineErrorBoundary key={doc.id}>
            <Scrollable.Root>
              <Scrollable.Viewport
                onScroll={handleScroll}
                ref={scrollViewportRef}
                data-dragging={dragging}
                className={clsx(
                  'affine-page-viewport',
                  styles.affineDocViewport,
                  styles.editorContainer
                )}
              >
                <PageDetailEditor onLoad={onLoad} />
              </Scrollable.Viewport>
              <Scrollable.Scrollbar
                className={clsx({
                  [styles.scrollbar]: !appSettings.clientBorder,
                })}
              />
            </Scrollable.Root>
            <EditorOutlineViewer
              editor={editorContainer}
              show={mode === 'page' && !isSideBarOpen}
              openOutlinePanel={openOutlinePanel}
            />
          </AffineErrorBoundary>
          {isInTrash ? <TrashPageFooter /> : null}
        </div>
      </ViewBody>

      {enableAI && (
        <ViewSidebarTab
          tabId="chart"
          icon={<AiIcon />}
          unmountOnInactive={false}
        >
          <EditorChatPanel editor={editorContainer} ref={chatPanelRef} />
        </ViewSidebarTab>
      )}

      <ViewSidebarTab tabId="properties" icon={<PropertyIcon />}>
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <DocPropertySidebar />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>

      <ViewSidebarTab tabId="journal" icon={<TodayIcon />}>
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <EditorJournalPanel />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>

      <ViewSidebarTab tabId="outline" icon={<TocIcon />}>
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <EditorOutlinePanel editor={editorContainer} />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
      </ViewSidebarTab>

      <ViewSidebarTab tabId="frame" icon={<FrameIcon />}>
        <Scrollable.Root className={styles.sidebarScrollArea}>
          <Scrollable.Viewport>
            <EditorFramePanel editor={editorContainer} />
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>
        </ViewSidebarTab>

      <GlobalPageHistoryModal />
      <PageAIOnboarding />
    </FrameworkScope>
  );
});

export const Component = () => {
  const params = useParams();
  const recentPages = useService(RecentDocsService);
  const navigate = useNavigate();

  const pageId = params.pageId;
  const { status, resolvedPageId } = useImportOnboardingDoc(pageId || '');

  useEffect(() => {
    if (pageId) {
      localStorage.setItem('last_page_id', pageId);
      recentPages.addRecentDoc(pageId);
    }
  }, [pageId, recentPages]);

  // Handle navigation for non-existent document
  useEffect(() => {
    if (status === 'success' && resolvedPageId && resolvedPageId !== pageId) {
      console.log('Navigating to resolved pageId:', resolvedPageId);
      navigate(`/workspace/local_workspace/${resolvedPageId}`, { replace: true });
    } else if (status === 'error') {
      console.log('Document error for pageId:', pageId, 'showing PageNotFound');
    }
  }, [status, resolvedPageId, pageId, navigate]);

  if (!pageId) {
    console.log('Missing pageId:', pageId);
    return null;
  }

  if (status === 'loading') {
    console.log('Loading onboarding template for pageId:', pageId);
    return <PageDetailSkeleton />;
  }

  const finalPageId = resolvedPageId || pageId;
  console.log('Rendering DetailPageWrapper with finalPageId:', finalPageId);

  return (
    <DetailPageWrapper
      pageId={finalPageId}
      skeleton={<PageDetailSkeleton />}
      notFound={<PageNotFound noPermission />}
    >
      <DetailPageImpl />
    </DetailPageWrapper>
  );
};