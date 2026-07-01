"use client";

import { useEffect } from "react";
import { Search } from "lucide-react";
import { CallWaiterButton } from "@/components/guest/call-waiter-button";
import { CartSummaryBar } from "@/components/guest/cart-summary-bar";
import { CategoryPills } from "@/components/guest/category-pills";
import { GuestHeader } from "@/components/guest/guest-header";
import { LanguageSelector } from "@/components/guest/language-selector";
import { OfflineIndicator } from "@/components/guest/offline-indicator";
import { MenuListItem } from "@/components/guest/menu-list-item";
import { ProductDetailSheet } from "@/components/guest/product-detail-sheet";
import { PullToRefresh } from "@/components/guest/pull-to-refresh";
import { AllergenFilter } from "@/components/guest/allergen-filter";
import { MenuGrid } from "@/components/guest/menu-grid";
import { PersonalizedMenuHighlights } from "@/components/guest/personalized-menu-highlights";
import { useGuestAccessibility } from "@/components/guest/guest-accessibility-provider";
import { DenisMemoryConsentBanner } from "@/components/guest/denis-memory-consent-banner";
import { AiSmartNudgeBanner } from "@/components/guest/ai-smart-nudge-banner";
import { GuestDenisLayer } from "@/components/guest/guest-denis-layer";
import { KitchenCapacityBar } from "@/components/guest/kitchen-capacity-bar";
import {
  AiCartPairingBanner,
  AiFeedbackPrompt,
  AiRecommendedSection,
  DenisSceneBanners,
} from "@/components/guest/menu-view/dynamic-imports";
import type { MenuViewProps } from "@/components/guest/menu-view/props";
import type { MenuViewState } from "@/hooks/use-menu-view";
import { isDemoGuestRoute } from "@/lib/demo-guest";
import { cn } from "@/lib/utils";

export function MenuViewShell({
  props,
  state,
}: {
  props: MenuViewProps;
  state: MenuViewState;
}) {
  const {
    slug,
    token,
    orgName,
    logoUrl,
    tableName,
    orderingEnabled = true,
    acceptingOrders = true,
    aiConciergeEnabled = false,
    memoryConsentPrompt = null,
    voiceEnabled = false,
    voiceTtsEnabled = true,
    googleReviewUrl = null,
    stripeOnboarded = false,
    paymentOnlineEnabled = false,
    paymentAtBarEnabled = false,
    paymentCardAtTableEnabled = false,
    inPersonPaymentLocation = "bar",
    taxPercent,
    currency,
    locationId,
    tableId,
  } = props;

  const {
    tUI,
    showingCachedMenu,
    handleRefresh,
    canPlaceOrders,
    search,
    setSearch,
    activeCategory,
    detailProduct,
    setDetailProduct,
    returnGlow,
    aiChatOpen,
    setAiChatOpen,
    aiActive,
    showRecommendedSection,
    setShowRecommendedSection,
    aiRecommendations,
    pairingRecommendation,
    setPairingRecommendation,
    menuMainRef,
    openProductDetail,
    itemCount,
    sessionToken,
    filteredCategories,
    scrollToCategory,
    excluded,
    toggle,
    clear,
    hiddenByAllergenCount,
    menuPersonalization,
    showPersonalizedHiddenAllergens,
    setShowPersonalizedHiddenAllergens,
    allUnavailableCategories,
    subtitle,
    welcomeBackMessage,
    scene,
    denisView,
    sceneLoading,
    refreshGuestSceneView,
    sceneBanners,
    capacityAmbient,
    useSceneBannerUi,
    getAiContext,
    feedbackOrder,
    showFeedback,
    productById,
    menuSectionByProductId,
    menuSectionByProductIdAll,
    customizableProductIds,
    aiReasonByProductId,
    hasDrinkInCart,
    activeNudge,
    dismissNudge,
    resetAiRecommendations,
    handleAddAiRecommendation,
    handleAddPairing,
    applySceneChipSelections,
    handleSceneTurnResult,
    handleSceneInlineAdd,
    handleApplyReorderItems,
    handleNudgeAction,
    handleSceneBannerAction,
    handleSceneBannerDismiss,
    handleNudgeAdd,
    handleAiChatSetupComplete,
    handleGuestLanguageDetected,
    profile,
    isReturning,
    saveGuestAllergies,
    filtered,
    searchQuery,
    deviceFingerprint,
    menuCategories,
    showMemoryConsent,
    acceptMemoryConsent,
    declineMemoryConsent,
  } = state;

  const { prefs: a11yPrefs, applyRemotePrefs } = useGuestAccessibility();
  const simplifiedMenu = a11yPrefs.simplifiedMenu;

  useEffect(() => {
    if (scene?.accessibility) {
      applyRemotePrefs(scene.accessibility);
    } else if (denisView?.accessibility) {
      applyRemotePrefs(denisView.accessibility);
    }
  }, [scene?.accessibility, denisView?.accessibility, applyRemotePrefs]);

  return (
    <>
      <OfflineIndicator showingCachedMenu={showingCachedMenu} />
      <PullToRefresh onRefresh={handleRefresh} orgInitial={orgName.charAt(0)}>
        <div
          className={cn(
            aiConciergeEnabled && !aiChatOpen
              ? orderingEnabled &&
                !detailProduct &&
                !aiChatOpen &&
                itemCount > 0
                ? "min-h-dvh pb-[calc(11rem+env(safe-area-inset-bottom,0px))]"
                : "min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
              : "min-h-dvh pb-cart-offset",
            aiChatOpen && "pointer-events-none select-none"
          )}
        >
          <GuestHeader
            orgName={orgName}
            logoUrl={logoUrl}
            subtitle={subtitle}
            tableName={tableName}
            trailing={<LanguageSelector compact />}
          />

          {!orderingEnabled && (
            <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
              Browse our menu. To order, ask your server.
            </div>
          )}

          {orderingEnabled && !acceptingOrders && (
            <div className="mx-4 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {tUI("menu.orderingPaused")}
            </div>
          )}

          {showMemoryConsent && (
            <DenisMemoryConsentBanner
              onAccept={() => void acceptMemoryConsent()}
              onDecline={declineMemoryConsent}
              promptTemplate={memoryConsentPrompt}
            />
          )}

          {aiConciergeEnabled && useSceneBannerUi && (
            <div className="guest-a11y-optional">
              <DenisSceneBanners
                banners={sceneBanners}
                onBannerAction={handleSceneBannerAction}
                onDismiss={handleSceneBannerDismiss}
              />
            </div>
          )}

          {aiConciergeEnabled &&
            capacityAmbient?.capacityMessage &&
            (capacityAmbient.capacityLevel === "yellow" ||
              capacityAmbient.capacityLevel === "red") && (
              <div className="guest-a11y-optional">
                <KitchenCapacityBar
                  message={capacityAmbient.capacityMessage}
                  level={capacityAmbient.capacityLevel}
                />
              </div>
            )}

          {!aiConciergeEnabled && (
            <div className="guest-a11y-optional">
              <AiSmartNudgeBanner
                nudge={activeNudge}
                orderingDisabled={!canPlaceOrders}
                onAction={handleNudgeAction}
                onAdd={handleNudgeAdd}
                onDismiss={dismissNudge}
              />
            </div>
          )}

          <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
            <div className="px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400 sm:start-4" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tUI("menu.search")}
                  aria-label={tUI("menu.search")}
                  className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-3 ps-10 pe-4 text-base text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-700 sm:py-2.5 sm:text-sm"
                />
              </div>
            </div>
            {!filtered && (
              <>
                <CategoryPills
                  categories={filteredCategories}
                  activeCategory={activeCategory}
                  onSelect={scrollToCategory}
                />
                <AllergenFilter
                  excluded={excluded}
                  onToggle={toggle}
                  onClear={clear}
                />
              </>
            )}
          </div>

          {!filtered &&
            !aiConciergeEnabled &&
            aiActive &&
            showRecommendedSection &&
            aiRecommendations.length > 0 && (
              <div className="guest-a11y-optional">
                <AiRecommendedSection
                  recommendations={aiRecommendations}
                  currency={currency}
                  orderingDisabled={!canPlaceOrders}
                  onAdd={handleAddAiRecommendation}
                  onDismiss={() => setShowRecommendedSection(false)}
                  onReset={resetAiRecommendations}
                />
              </div>
            )}

          <main ref={menuMainRef} className="px-3 py-4 sm:px-4 sm:py-6">
            {menuPersonalization.meta ? (
              <div className="guest-a11y-optional">
                <PersonalizedMenuHighlights
                  meta={menuPersonalization.meta}
                  showHiddenAllergens={showPersonalizedHiddenAllergens}
                  onToggleHiddenAllergens={() =>
                    setShowPersonalizedHiddenAllergens((value) => !value)
                  }
                  onSelectProduct={(productId) => {
                    const product = productById.get(productId);
                    if (product) openProductDetail(product);
                  }}
                />
              </div>
            ) : null}
            {hiddenByAllergenCount > 0 && (
              <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
                {tUI("allergen.hiddenCount", { count: hiddenByAllergenCount })}
              </p>
            )}
            {filtered ? (
              <div>
                {filtered.length === 0 ? (
                  <p className="py-12 text-center text-zinc-400">
                    {tUI("menu.noResults", { query: searchQuery })}
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--qr-elevated)]/80">
                    {filtered.map((product) => (
                      <MenuListItem
                        key={product.id}
                        product={product}
                        currency={currency}
                        menuSection={
                          menuSectionByProductId.get(product.id) ?? "food"
                        }
                        orderingDisabled={!canPlaceOrders}
                        simplifiedMenu={simplifiedMenu}
                        onOpenDetail={() => openProductDetail(product)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <MenuGrid
                categories={filteredCategories}
                unavailableCategories={allUnavailableCategories}
                currency={currency}
                orderingDisabled={!canPlaceOrders}
                simplifiedMenu={simplifiedMenu}
                onOpenDetail={openProductDetail}
                aiReasonByProductId={aiReasonByProductId}
                personalizationByProductId={menuPersonalization.badges}
              />
            )}

            <div className="mt-8 flex flex-col gap-4 pb-4">
              {showFeedback && feedbackOrder && (
                <div className="px-1">
                  <p className="mb-2 text-center text-xs text-zinc-400">
                    {tUI("ai.feedback.onMenuHint")}
                  </p>
                  <AiFeedbackPrompt
                    orderId={feedbackOrder.id}
                    sessionToken={sessionToken!}
                    deliveredAt={null}
                    googleReviewUrl={googleReviewUrl}
                    locationId={locationId}
                    tableId={tableId}
                    deviceFingerprint={deviceFingerprint}
                    slug={slug}
                    tableToken={token}
                    venueName={props.locationName}
                  />
                </div>
              )}
              <div className="flex justify-center">
                <CallWaiterButton token={token} tableName={tableName} />
              </div>
            </div>
          </main>

          {orderingEnabled && (
            <>
              {pairingRecommendation && !hasDrinkInCart && (
                <AiCartPairingBanner
                  recommendation={pairingRecommendation}
                  currency={currency}
                  orderingDisabled={!canPlaceOrders}
                  onAdd={handleAddPairing}
                  onDismiss={() => setPairingRecommendation(null)}
                />
              )}
              {!detailProduct && !aiChatOpen && (
                <CartSummaryBar
                  slug={slug}
                  token={token}
                  taxPercent={taxPercent}
                  currency={currency}
                  glowOnMount={returnGlow}
                />
              )}
            </>
          )}

          <ProductDetailSheet
            product={detailProduct}
            currency={currency}
            orderingDisabled={!canPlaceOrders}
            menuSection={
              detailProduct
                ? menuSectionByProductId.get(detailProduct.id) ?? "food"
                : "food"
            }
            open={!!detailProduct}
            onOpenChange={(o) => !o && setDetailProduct(null)}
          />
        </div>
      </PullToRefresh>

      {aiConciergeEnabled ? (
        <GuestDenisLayer
          enabled
          slug={slug}
          token={token}
          locationId={locationId}
          tableId={tableId}
          sessionToken={sessionToken}
          currency={currency}
          taxPercent={taxPercent}
          orderingDisabled={!canPlaceOrders}
          voiceEnabled={voiceEnabled}
          voiceTtsEnabled={voiceTtsEnabled}
          tableName={tableName}
          venueName={props.locationName}
          dockSubtitle={welcomeBackMessage ?? undefined}
          cartBarVisible={orderingEnabled && !detailProduct && itemCount > 0}
          orderMoreChipAction="scroll"
          controlledView={{
            view: denisView,
            scene,
            loading: sceneLoading,
            refresh: refreshGuestSceneView,
          }}
          getBrowsingContext={getAiContext}
          onChatOpenChange={setAiChatOpen}
          onGuestLanguageDetected={handleGuestLanguageDetected}
          onSceneTurnResult={handleSceneTurnResult}
          onSceneChipSelections={applySceneChipSelections}
          onInlineAddProduct={handleSceneInlineAdd}
          onApplyReorderItems={handleApplyReorderItems}
          stripeOnboarded={stripeOnboarded}
          paymentOnlineEnabled={paymentOnlineEnabled}
          paymentAtBarEnabled={paymentAtBarEnabled}
          paymentCardAtTableEnabled={paymentCardAtTableEnabled}
          inPersonPaymentLocation={inPersonPaymentLocation}
          menuChat={{
            isDemo: isDemoGuestRoute(slug, token),
            menuCategories,
            menuSectionByProductId: menuSectionByProductIdAll,
            productTaxRateById: new Map(
              [...productById.values()].map((p) => [
                p.id,
                p.tax_rate != null ? Number(p.tax_rate) : null,
              ])
            ),
            scrollContext: getAiContext,
            guestProfile: profile,
            isReturning,
            onAddToCart: handleAddAiRecommendation,
            customizableProductIds,
            onOpenProductDetail: (productId) => {
              const product = productById.get(productId);
              if (product) openProductDetail(product);
            },
            onRecommendations: handleAiChatSetupComplete,
            onSaveAllergies: saveGuestAllergies,
          }}
        />
      ) : null}
    </>
  );
}
