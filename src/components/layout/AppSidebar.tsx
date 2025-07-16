import React from 'react';
import ReactDOM from 'react-dom';
import { useProfile } from '@/hooks/useProfile';
import { useClientInfo } from '@/hooks/useClientInfo';
import { useAuth } from '@/hooks/useAuth';
import { usePendingTasksContext } from '@/contexts/PendingTasksContext';
import { useActiveStepAssignments } from '@/hooks/useActiveStepAssignments';
import { Link, useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Building2, BookOpen, BookOpenCheck, LayoutDashboard, UserCheck, Phone, HelpCircle, UsersRound } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { Badge } from '@/components/ui/badge';
import { BrandedAppHeader } from './BrandedAppHeader';

interface MenuItem {
  title: string;
  icon: React.ComponentType<any>;
  url: string;
  badge?: number;
  hasAlert?: boolean;
}

// Custom tooltip component using portal
const CustomTooltip = ({ children, content, show }: { children: React.ReactNode, content: string, show: boolean }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  
  if (!show) return <>{children}</>;
  
  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.right + 8, // 8px gap from the right edge
        y: rect.top + rect.height / 2 // Center vertically
      });
    }
    setIsHovered(true);
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
  };
  
  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {isHovered && ReactDOM.createPortal(
        <div 
          className="fixed z-[9999] px-3 py-2 bg-white text-gray-900 text-sm rounded-md shadow-lg border border-gray-200 whitespace-nowrap pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translateY(-50%)'
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};

export function AppSidebar() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { client } = useClientInfo(profile?.client_id);
  const { pendingCount } = usePendingTasksContext();
  const { hasActiveAssignments, activeCount } = useActiveStepAssignments();
  const location = useLocation();
  const { state } = useSidebar();

  const getMenuItems = (): MenuItem[] => {
    const role = profile?.role;
    const commonItems: MenuItem[] = [
      {
        title: "Dashboard",
        icon: LayoutDashboard,
        url: "/"
      }
    ];

    const knowledgeBaseItem: MenuItem = {
      title: "Help",
      icon: HelpCircle,
      url: "/knowledge-base"
    };

    const executionsItem: MenuItem = {
      title: "Executions",
      icon: BookOpenCheck,
      url: "/executions",
      badge: pendingCount > 0 ? pendingCount : undefined,
      hasAlert: hasActiveAssignments
    };

    switch (role) {
      case 'kelyn_admin':
        return [...commonItems, {
          title: "All Teams",
          icon: UsersRound,
          url: "/clients"
        },  {
          title: "Users",
          icon: UserCheck,
          url: "/users"
        },
        {
          title: "All Runbooks",
          icon: BookOpen,
          url: "/runbooks"
        }, executionsItem, knowledgeBaseItem];
      case 'kelyn_rep':
        return [...commonItems, {
          title: "My Teams",
          icon: Building2,
          url: "/clients"
        }, {
          title: "Team Runbooks",
          icon: BookOpen,
          url: "/runbooks"
        }, executionsItem, knowledgeBaseItem];
      case 'client_admin':
        return [...commonItems, {
          title: "Teams",
          icon: Building2,
          url: "/clients"
        }, {
          title: "Runbooks",
          icon: BookOpen,
          url: "/runbooks"
        }, {
          title: "Users",
          icon: UserCheck,
          url: "/users"
        }, executionsItem, knowledgeBaseItem];
      case 'client_member':
        return [...commonItems, {
          title: "Runbooks",
          icon: BookOpen,
          url: "/runbooks"
        }, executionsItem, knowledgeBaseItem];
      default:
        return [...commonItems, knowledgeBaseItem];
    }
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar 
      className="border-r border-sidebar-border" 
      collapsible="icon"
      style={{
        '--sidebar-width-icon': '4rem'
      } as React.CSSProperties}
    >
      <SidebarHeader className="px-6 py-[.955rem] border-b border-sidebar-border">
        <BrandedAppHeader />
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu className="space-y-3">
              {menuItems.map(item => {
                const isActive = location.pathname === item.url;
                let tooltipContent = item.title;
                if (item.badge) {
                  tooltipContent = `${item.title} (${item.badge})`;
                } else if (item.hasAlert && item.title === 'Executions') {
                  tooltipContent = `${item.title} (${activeCount} active)`;
                }
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <CustomTooltip content={tooltipContent} show={state === "collapsed"}>
                      <SidebarMenuButton asChild isActive={isActive} className="h-11 relative">
                        <Link to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          {item.badge && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
                              {item.badge}
                            </Badge>
                          )}
                          {item.hasAlert && !item.badge && (
                            <div className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Active assignments"></div>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </CustomTooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Emergency assistance box, hidden when collapsed to icon mode */}
      <div className="px-4 py-[15px] group-data-[collapsible=icon]:hidden">
        <div className="bg-gradient-to-br from-white to-white backdrop-blur-sm border border-white rounded-md px-2 py-1 flex flex-col items-center">
          <span className="text-[10px] text-gray-600">For Emergencies</span>
          <div className="flex items-center space-x-1">
            <Phone className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">1-800 KELYN</span>
          </div>
        </div>
      </div>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
