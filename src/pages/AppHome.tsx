import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';
import { ProgressiveCategorySelector } from '@/components/filter/ProgressiveCategorySelector';
import { DateRangeFilter } from '@/components/filter/DateRangeFilter';
import { ActivitiesTable } from '@/components/activity/ActivitiesTable';
import { ExcelExportModal } from '@/components/activity/ExcelExportModal';
import { ExcelImportModal } from '@/components/activity/ExcelImportModal';
import { StructureTableView } from '@/components/structure/StructureTableView';
import { StructureSunburstView } from '@/components/structure/StructureSunburstView';
import { StructureViewSwitcher } from '@/components/structure/StructureViewSwitcher';
import type { StructureViewMode } from '@/components/structure/StructureViewSwitcher';
import { Button } from '@/components/ui/Button';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { exportStructureExcel, structureExportFilename } from '@/lib/structureExcel';
import { StructureImportModal } from '@/components/structure/StructureImportModal';
import { saveAs } from 'file-saver';
import { useStructureData } from '@/hooks/useStructureData';
import { SharedAreaBanner } from '@/components/sharing/SharedAreaBanner';
import { ShareManagementModal } from '@/components/sharing/ShareManagementModal';
import { HeaderAvatar, ProfileSettingsModal } from '@/components/sharing/ProfileSettingsModal';
import type { Category } from '@/types/database';
import type { UUID } from '@/types';

// --------------------------------------------
// Icons
// --------------------------------------------

const StructureIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const ActivitiesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const AddIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

// --------------------------------------------
// Tab Types
// --------------------------------------------

type TabType = 'activities' | 'structure';

// --------------------------------------------
// Main Content (inside FilterProvider)
// --------------------------------------------

function AppContent() {
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('activities');
  const [structureViewMode, setStructureViewMode] = useState<StructureViewMode>('sunburst');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isExportingStructure, setIsExportingStructure] = useState(false);
  const [showStructureImport, setShowStructureImport] = useState(false);
  const [structureRefreshKey, setStructureRefreshKey] = useState(0);
  
  // Structure data (needed for Export button)
  const { refetch: refetchStructure } = useStructureData();

  // Get filter context
  const {
    filter,
    isLeafCategory,
    fullPathDisplay,
    hasActiveFilter,
    reset,
    sharedContext,
    areaHasActiveShares,
  } = useFilter();

  // Share Management Modal state (Faza 7)
  const [shareModalTarget, setShareModalTarget] = useState<{ areaId: UUID; areaName: string } | null>(null);
  const openShareModal = (areaId: UUID, areaName: string) => setShareModalTarget({ areaId, areaName });
  
  // Responsive state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // Collapse filter when returning from View/Edit (collapseFilter flag in location.state)
  const [isFilterExpanded, setIsFilterExpanded] = useState(() => {
    const state = location.state as { collapseFilter?: boolean } | null;
    return !state?.collapseFilter;
  });

  // Ako korisnik je grantee i ima Edit Mode aktivan, resetiraj ga
  useEffect(() => {
    if (sharedContext && isEditMode) setIsEditMode(false);
  }, [sharedContext, isEditMode]);

  // Get user info (email + display_name from profiles)
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? '';
      const em = data.session?.user.email ?? '';
      setUserId(id);
      setEmail(em);
      if (id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', id)
          .single();
        setDisplayName((profile as { display_name: string | null } | null)?.display_name ?? em);
      }
    });
  }, []);

  // Handle resize – only react to WIDTH changes (orientation change).
  // On Android, opening the virtual keyboard fires a resize event but only
  // changes window.innerHeight (viewport shrinks). We must NOT collapse the
  // filter in that case, otherwise opening the Save Shortcut modal (which
  // has autoFocus → triggers keyboard) closes the filter behind the modal.
  useEffect(() => {
    let lastWidth = window.innerWidth;

    const handleResize = () => {
      const newWidth = window.innerWidth;
      const widthChanged = newWidth !== lastWidth;
      lastWidth = newWidth;

      const mobile = newWidth < 768;
      setIsMobile(mobile);

      // Collapse filter only on actual orientation/layout change (width changed),
      // NOT on keyboard popup (height-only change).
      if (widthChanged && mobile && hasActiveFilter) {
        setIsFilterExpanded(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasActiveFilter]);

  // Sign out handler
  const onSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed out');
      nav('/login');
    }
  };

  // Handle leaf category selection - show toast
  const handleLeafSelected = (_category: Category, path: Category[]) => {
    toast.success(`✓ Category selected: ${path.map(c => c.name).join(' > ')}`);
    if (isMobile) {
      setIsFilterExpanded(false);
    }
  };

  // D1: Read grantee cannot add activities
  const isReadOnlyGrantee = sharedContext?.permission === 'read';
  // Can add activity only when leaf category is selected AND not read-only
  const canAddActivity = isLeafCategory && !isReadOnlyGrantee;

  // Navigate to Add Activity
  const handleAddActivity = () => {
    if (isReadOnlyGrantee) {
      toast.error('Read only access — cannot add activities');
      return;
    }
    if (!canAddActivity) {
      toast.error('Please select a leaf category first');
      return;
    }
    nav('/app/add', {
      state: {
        areaId: filter.areaId,
        categoryId: filter.categoryId,
        categoryPath: fullPathDisplay.split(' > ')  // Includes Area name
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col">
      {/* ========================================
          HEADER - Fixed at top
          ======================================== */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* Logo / Title */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs sm:text-sm">ET</span>
              </div>
              <h1 className="font-semibold text-gray-900 text-sm sm:text-base hidden sm:block">
                Events Tracker
              </h1>
            </div>

            {/* Full Path Display - Center */}
            <div className="flex-1 mx-2 sm:mx-4 min-w-0">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-lg truncate">
                <FolderIcon />
                <span className="truncate">{fullPathDisplay || 'No selection'}</span>
              </div>
            </div>

            {/* User section — avatar opens Profile Settings modal */}
            <div className="flex items-center gap-2">
              {userId && (
                <HeaderAvatar
                  userId={userId}
                  displayName={displayName || email}
                  onClick={() => setShowProfileModal(true)}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================
          MAIN CONTENT
          ======================================== */}
      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-4">
        
        {/* ========================================
            FILTER SECTION - Collapsible on mobile
            ======================================== */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 sm:mb-4">
          {/* Filter Header */}
          <div 
            className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 cursor-pointer"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-gray-900 text-sm sm:text-base">Filter</h2>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Faza 7 — Entry point 1: Manage Access badge (owner, area has active shares) */}
              {!sharedContext && areaHasActiveShares && filter.areaId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openShareModal(filter.areaId!, fullPathDisplay.split(' > ')[0] || 'Area');
                  }}
                  className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 px-2 py-1 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                >
                  🔗 Manage Access
                </button>
              )}
              {hasActiveFilter && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1"
                >
                  Clear all
                </button>
              )}
              <span className="text-gray-400">
                {isFilterExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </span>
            </div>
          </div>

          {/* Filter Content */}
          {isFilterExpanded && (
            <div className="px-3 pb-3 sm:px-4 sm:pb-4 border-t border-gray-100 pt-3">
              <ProgressiveCategorySelector
                onLeafSelected={handleLeafSelected}
              />
              
              {/* Date Range Filter - only for Activities tab */}
              {activeTab === 'activities' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <DateRangeFilter />
                </div>
              )}
            </div>
          )}
        </section>

        {/* ========================================
            TABS + ACTION BUTTONS
            Activities tab: Add Activity button
            Structure tab:  View switcher + Export stub + Edit Mode stub
            ======================================== */}
        <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
          {/* Tabs */}
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-100">
            <TabButton
              active={activeTab === 'activities'}
              onClick={() => setActiveTab('activities')}
              icon={<ActivitiesIcon />}
              label="Activities"
              isMobile={isMobile}
            />
            <TabButton
              active={activeTab === 'structure'}
              onClick={() => setActiveTab('structure')}
              icon={<StructureIcon />}
              label="Structure"
              isMobile={isMobile}
            />
          </div>

          {/* Right-side action area — changes per tab */}
          {activeTab === 'activities' ? (
            /* ---- Activities: Add Activity button ---- */
            <Button
              leftIcon={<AddIcon />}
              onClick={handleAddActivity}
              disabled={!canAddActivity}
              title={isReadOnlyGrantee ? 'Read only access' : undefined}
              className={cn(
                'transition-all',
                canAddActivity
                  ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200'
                  : '',
              )}
            >
              {isMobile ? '' : 'Add Activity'}
            </Button>
          ) : (
            /* ---- Structure: View switcher + Export + Edit Mode ---- */
            <div className="flex items-center gap-2">
              {/* View switcher — desktop only, auto-hidden on mobile inside component */}
              <StructureViewSwitcher
                viewMode={isEditMode ? 'table' : structureViewMode}
                onChange={setStructureViewMode}
                disabled={isEditMode}
              />

              {/* Import button (S20C) */}
              <button
                title="Import structure from Excel"
                onClick={() => setShowStructureImport(true)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  THEME.structure.btnEditMode,
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {!isMobile && <span>Import</span>}
              </button>

              {/* Export button (S17) */}
              <button
                disabled={isExportingStructure}
                title="Export structure to Excel"
                onClick={async () => {
                  setIsExportingStructure(true);
                  try {
                    const freshNodes = await refetchStructure(); // Always export fresh data
                    const buffer = await exportStructureExcel(freshNodes, {
                      filterAreaId: filter.areaId ?? null,
                      filterCategoryId: filter.categoryId ?? null,
                    });
                    const blob = new Blob([buffer], {
                      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    });
                    saveAs(blob, structureExportFilename());
                    toast.success('Structure exported');
                  } catch (err) {
                    console.error('Structure export failed:', err);
                    toast.error('Export failed');
                  } finally {
                    setIsExportingStructure(false);
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isExportingStructure ? 'opacity-50 cursor-not-allowed' : '',
                  THEME.structure.btnExport,
                )}
              >
                {isExportingStructure ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {!isMobile && <span>{isExportingStructure ? 'Exporting...' : 'Export'}</span>}
              </button>

              {/* Edit Mode toggle — skriveno za grantee (read-only shared area) */}
              {!sharedContext && (
                <button
                  onClick={() => setIsEditMode(v => !v)}
                  title={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isEditMode
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-600'
                      : THEME.structure.btnEditMode,
                  )}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {!isMobile && <span>{isEditMode ? 'Exit Edit' : 'Edit Mode'}</span>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Leaf category hint — Activities tab only, not shown for read grantee */}
        {activeTab === 'activities' && !isLeafCategory && filter.categoryId && !isReadOnlyGrantee && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            ⚠️ Select a leaf category (no subcategories) to add an activity
          </div>
        )}

        {/* ========================================
            TAB CONTENT
            overflow-hidden NAMJERNO UKLONJEN - klipao bi dropdown menije u ActivitiesTable
            ======================================== */}
        <section className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {activeTab === 'structure' ? (
            <StructureTabContent
              viewMode={isEditMode ? 'table' : structureViewMode}
              isEditMode={isEditMode}
              refreshKey={structureRefreshKey}
              onManageAccess={openShareModal}
            />
          ) : (
            <ActivitiesView />
          )}
        </section>
      </main>

      {/* Profile Settings Modal (Faza 8) */}
      {showProfileModal && userId && (
        <ProfileSettingsModal
          userId={userId}
          email={email}
          onClose={() => {
            setShowProfileModal(false);
            // Reload display_name in case user changed it
            supabase
              .from('profiles')
              .select('display_name')
              .eq('id', userId)
              .single()
              .then(({ data }) => {
                setDisplayName((data as { display_name: string | null } | null)?.display_name ?? email);
              });
          }}
          onSignOut={onSignOut}
        />
      )}

      {/* Share Management Modal (Faza 7) */}
      {shareModalTarget && (
        <ShareManagementModal
          areaId={shareModalTarget.areaId}
          areaName={shareModalTarget.areaName}
          onClose={() => setShareModalTarget(null)}
        />
      )}

      {/* Structure Import Modal (S20C) */}
      {showStructureImport && userId && (
        <StructureImportModal
          userId={userId}
          onClose={() => setShowStructureImport(false)}
          onImported={() => {
            window.dispatchEvent(new CustomEvent('areas-changed'));
            refetchStructure();
            setStructureRefreshKey(k => k + 1);
            // Modal stays open so user can read the result summary;
            // user closes it via the "Close" button.
          }}
          getNodes={refetchStructure}
        />
      )}
    </div>
  );
}

// --------------------------------------------
// Tab Button Component
// --------------------------------------------

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isMobile: boolean;
}

function TabButton({ active, onClick, icon, label, isMobile }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      )}
    >
      {icon}
      {!isMobile && <span>{label}</span>}
    </button>
  );
}

// --------------------------------------------
// Structure Tab Content
// Combines Table View + Sunburst based on viewMode.
// Desktop: both views available (controlled by StructureViewSwitcher).
// Mobile: always Table View (Sunburst hidden inside StructureSunburstView).
// --------------------------------------------

interface StructureTabContentProps {
  viewMode: StructureViewMode;
  isEditMode: boolean;
  refreshKey: number;
  /** Faza 7 — open Share Management modal */
  onManageAccess: (areaId: UUID, areaName: string) => void;
}

function StructureTabContent({ viewMode, isEditMode, refreshKey, onManageAccess }: StructureTabContentProps) {
  const { filter, fullPathDisplay } = useFilter();

  return (
    <div>
      {/* Shared area banner — Entry point 2: ⚙ Manage Access button (owner) */}
      <SharedAreaBanner
        tab="structure"
        onManageAccess={
          filter.areaId
            ? () => onManageAccess(filter.areaId!, fullPathDisplay.split(' > ')[0] || 'Area')
            : undefined
        }
      />

      {/* Sunburst — hidden on mobile via internal class; hidden when table mode */}
      {viewMode === 'sunburst' && !isEditMode && (
        <div className="hidden md:block p-2">
          <StructureSunburstView />
        </div>
      )}

      {/* Table View — always visible on mobile; shown on desktop when mode=table */}
      {/* Entry point 3: ⚙ Manage Access in CategoryChainRow ⋮ menu */}
      <div className={viewMode === 'sunburst' && !isEditMode ? 'md:hidden' : ''}>
        <StructureTableView
          isEditMode={isEditMode}
          refreshKey={refreshKey}
          onManageAccess={onManageAccess}
        />
      </div>
    </div>
  );
}

// --------------------------------------------
// Activities View
// --------------------------------------------

function ActivitiesView() {
  const nav = useNavigate();
  const { fullPathDisplay, isLeafCategory, setDateRange } = useFilter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleEditActivity = (sessionStart: string | null, categoryId: UUID, eventId: UUID) => {
    if (sessionStart) {
      // Normal case: navigate by session_start + categoryId
      const encodedSessionStart = encodeURIComponent(sessionStart);
      nav(`/app/edit/${encodedSessionStart}?categoryId=${categoryId}`);
    } else {
      // Fallback: activity has no session_start, navigate by single eventId
      nav(`/app/edit/${eventId}?noSession=1&categoryId=${categoryId}`);
    }
  };

  const handleViewDetails = (sessionStart: string | null, categoryId: UUID, eventId: UUID) => {
    if (sessionStart) {
      const encodedSessionStart = encodeURIComponent(sessionStart);
      nav(`/app/view/${encodedSessionStart}?categoryId=${categoryId}`);
    } else {
      nav(`/app/view/${eventId}?noSession=1&categoryId=${categoryId}`);
    }
  };

  // P1: Delete activity - briše events, attributes, storage fajlove
  const handleDeleteActivity = async (sessionStart: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Dohvati sve events za ovaj sessionStart
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('session_start', sessionStart)
        .eq('user_id', user.id);

      if (eventsError) throw eventsError;
      if (!events || events.length === 0) return;

      const eventIds = (events as { id: string }[]).map(e => e.id);

      // Dohvati attachment URL-ove za brisanje iz storagea
      const { data: attachments } = await supabase
        .from('event_attachments')
        .select('url')
        .in('event_id', eventIds);

      // Briši fajlove iz Supabase storagea
      if (attachments && attachments.length > 0) {
        const paths = (attachments as { url: string }[])
          .map(a => {
            const parts = a.url.split('/activity-attachments/');
            return parts.length > 1 ? parts[1] : null;
          })
          .filter((p): p is string => p !== null);

        if (paths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('activity-attachments')
            .remove(paths);
          if (storageError) {
            console.error('Storage delete error (non-fatal):', storageError);
          }
        }
      }

      // Briši event_attachments iz DB
      await supabase.from('event_attachments').delete().in('event_id', eventIds);

      // Briši event_attributes iz DB
      await supabase.from('event_attributes').delete().in('event_id', eventIds);

      // Briši events iz DB
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (deleteError) throw deleteError;

      // Osvježi tablicu
      setRefreshKey(prev => prev + 1);
      toast.success(`Aktivnost obrisana (${events.length} event${events.length !== 1 ? 's' : ''})`);

    } catch (err) {
      console.error('Delete activity failed:', err);
      toast.error('Brisanje nije uspjelo');
      throw err; // Propagate so ActivityRow može resetirati UI
    }
  };

  return (
    <div>
      {/* Current Path Info */}
      {fullPathDisplay && (
        <div className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <FolderIcon />
            <span className="text-blue-900 font-medium">{fullPathDisplay}</span>
            {isLeafCategory && (
              <span className="ml-auto text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                ✓ Leaf
              </span>
            )}
          </div>
        </div>
      )}

      {/* Shared area banner */}
      <SharedAreaBanner tab="activities" />

      {/* Activities Table */}
      <ActivitiesTable 
        key={refreshKey}
        onEditActivity={handleEditActivity}
        onViewDetails={handleViewDetails}
        onDeleteActivity={handleDeleteActivity}
        onExport={() => setShowExport(true)}
        onImport={() => setShowImport(true)}
      />

      {/* Export Modal */}
      {showExport && (
        <ExcelExportModal onClose={() => setShowExport(false)} />
      )}

      {/* Import Modal */}
      {showImport && (
        <ExcelImportModal
          onClose={() => setShowImport(false)}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
          onSuccess={() => {
            setShowImport(false);
            // UX-3: reset date filter to All Time so newly imported events are visible
            setDateRange(null, null);
          }}
        />
      )}

    </div>
  );
}

// --------------------------------------------
// Main Export
// --------------------------------------------

export default function AppHome() {
  return <AppContent />;
}
