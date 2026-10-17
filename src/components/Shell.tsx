import '../styles/app.css'
import '../styles/components.css'
import '../styles/routes.css'
import { Link, useLocation } from 'wouter'
import { Blocks, BookOpen, Bot, BriefcaseBusiness, ChevronsUpDown, Compass, GraduationCap, House, LogOut, Monitor, Moon, ScrollText, Share2, Shield, Sun, University, UserRound, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { shareLink, useCopy } from '../lib/hooks'
import { startTour } from './Tour'
import { setTheme, useTheme, type Theme } from '../lib/theme'
import { hasNews } from '../lib/whats-new'
import posthog from '../lib/posthog'
import { BoothSignMark } from './BoothSignMark'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { TooltipProvider } from '@/components/ui/tooltip'

// Deep routes that belong to a section without sharing its URL prefix.
const ALSO: Record<string, string[]> = { '/jobs': ['/board', '/scout'], '/contacts': ['/s/'], '/prepare': ['/practice'] }

function useActive(href: string) {
  const [loc] = useLocation()
  return href === '/' ? loc === '/' : [href, ...(ALSO[href] ?? [])].some((p) => loc.startsWith(p))
}

type Section = { href: string; label: string; icon: typeof House; tour: string; badge?: number }

export function Shell({ email, isAdmin, onSignOut, children }: { email: string; isAdmin: boolean; onSignOut: () => void; children: ReactNode }) {
  // One small request per page change keeps the Jobs count current after acting on it elsewhere.
  const [loc] = useLocation()
  const [due, setDue] = useState(0)
  useEffect(() => {
    const load = () => void api.due().then((r) => setDue(r.count), () => {})
    load()
    // Also after a change that stays on the page (marked applied from For you).
    addEventListener('agisse:jobs', load)
    return () => removeEventListener('agisse:jobs', load)
  }, [loc])

  const sections: Section[] = [
    { href: '/', label: 'Today', icon: House, tour: 'today' },
    { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness, tour: 'jobs', badge: due },
    { href: '/education', label: 'Education', icon: University, tour: 'education' },
    { href: '/prepare', label: 'Prepare', icon: GraduationCap, tour: 'prepare' },
    { href: '/contacts', label: 'People', icon: Users, tour: 'people' },
  ]

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon" className="max-md:hidden">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" render={<Link href="/" aria-label="Agisse, home" />} className="gap-2.5 font-semibold text-[15px] tracking-tight no-underline">
                  <BoothSignMark className="size-7! shrink-0" />
                  <span>Agisse</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu className="gap-0.5">
                {sections.map((s) => (
                  <SidebarNavItem key={s.href} section={s} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <AccountMenu email={email} isAdmin={isAdmin} onSignOut={onSignOut} />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <div className="app-main flex min-w-0 flex-1 flex-col bg-background">
          {/* Phones: wordmark and account on top, the sections as an iOS-style tab bar below. */}
          <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl md:hidden">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight no-underline" aria-label="Agisse, home">
              <BoothSignMark className="size-6" />
              Agisse
            </Link>
            <AccountMenu email={email} isAdmin={isAdmin} onSignOut={onSignOut} compact />
          </header>
          {children}
          <nav
            aria-label="Sections"
            className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
            style={{ gridTemplateColumns: `repeat(${sections.length}, 1fr)` }}
          >
            {sections.map((s) => (
              <TabBarItem key={s.href} section={s} />
            ))}
          </nav>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function SidebarNavItem({ section: s }: { section: Section }) {
  const active = useActive(s.href)
  return (
    <SidebarMenuItem data-tour={s.tour}>
      <SidebarMenuButton
        isActive={active}
        tooltip={s.label}
        render={<Link href={s.href} aria-current={active ? 'page' : undefined} aria-label={s.badge ? `${s.label}, ${s.badge} due` : undefined} />}
        className="h-9 text-[15px] no-underline data-active:text-primary [&_svg]:size-[18px]"
      >
        <s.icon aria-hidden="true" />
        <span>{s.label}</span>
      </SidebarMenuButton>
      {!!s.badge && <SidebarMenuBadge className="top-2 tabular-nums rounded-full bg-primary px-1.5 text-white peer-data-active/menu-button:text-white">{s.badge}</SidebarMenuBadge>}
    </SidebarMenuItem>
  )
}

function TabBarItem({ section: s }: { section: Section }) {
  const active = useActive(s.href)
  return (
    <Link
      href={s.href}
      data-tour={s.tour}
      aria-current={active ? 'page' : undefined}
      aria-label={s.badge ? `${s.label}, ${s.badge} due` : undefined}
      className={cn('relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium no-underline', active ? 'text-primary' : 'text-muted-foreground')}
    >
      <s.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
      {s.label}
      {!!s.badge && <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-white tabular-nums">{s.badge}</span>}
    </Link>
  )
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/** The account behind the email: profile, the extras, appearance, sign out. */
function AccountMenu({ email, isAdmin, onSignOut, compact }: { email: string; isAdmin: boolean; onSignOut: () => void; compact?: boolean }) {
  const [loc, navigate] = useLocation()
  const theme = useTheme()
  const shared = useCopy()
  // Re-read on every page change, so the dot goes once What's new has been opened.
  const news = loc !== '/changelog' && hasNews()
  const label = `Account, ${email}${news ? ", something new in What's new" : ''}`
  const dot = <span aria-hidden="true" className="absolute top-0 right-0 size-2.5 rounded-full bg-primary ring-2 ring-background" />
  const initial = <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{email[0]?.toUpperCase()}</AvatarFallback>
  return (
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger data-tour="account" className="-mr-1.5 grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={label}>
          <span className="relative">
            <Avatar className="size-8">{initial}</Avatar>
            {news && dot}
          </span>
        </DropdownMenuTrigger>
      ) : (
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenuTrigger data-tour="account" render={<SidebarMenuButton size="lg" aria-label={label} />}>
              <span className="relative shrink-0">
                <Avatar className="size-8">{initial}</Avatar>
                {news && dot}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
            </DropdownMenuTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      )}
      <DropdownMenuContent side={compact ? 'bottom' : 'top'} align={compact ? 'end' : 'start'} className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <UserRound aria-hidden="true" /> Profile &amp; settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/extension')}>
            <Blocks aria-hidden="true" /> Browser extension
          </DropdownMenuItem>
          {/* Static VitePress site, not a SPA route, so a full navigation. */}
          <DropdownMenuItem onClick={() => (location.href = '/docs/')}>
            <BookOpen aria-hidden="true" /> Docs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/changelog')}>
            <ScrollText aria-hidden="true" /> What's new
            {news && <span className="ml-auto size-2 rounded-full bg-primary"><span className="sr-only">, new</span></span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            closeOnClick={false}
            onClick={() => {
              posthog.capture('invite_link_shared', { source: 'account_menu' })
              void shareLink(location.origin, shared.copy)
            }}
          >
            <Share2 aria-hidden="true" /> {shared.copied ? 'Link copied' : 'Share Agisse'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/agent')}>
            <Bot aria-hidden="true" /> Connect your AI
          </DropdownMenuItem>
          <DropdownMenuItem onClick={startTour}>
            <Compass aria-hidden="true" /> Take the tour
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => navigate('/admin')}>
              <Shield aria-hidden="true" /> Admin
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {(() => {
              const Icon = THEMES.find((t) => t.value === theme)!.icon
              return <Icon aria-hidden="true" />
            })()}
            Appearance
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
              {THEMES.map((t) => (
                <DropdownMenuRadioItem key={t.value} value={t.value}>
                  <t.icon aria-hidden="true" /> {t.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
