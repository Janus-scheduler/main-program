import {
  GridIcon,
  PeopleIcon,
  DoorIcon,
  EquipmentIcon,
  SettingsIcon,
} from "../icons";

interface SidebarProps {
  onSync: () => void;
}

/**
 * Sidebar
 *
 * The fixed left navigation panel.
 * Static in this demo — nav items do not route anywhere yet.
 */
export function Sidebar({ onSync }: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">
        <span className="brand-icon">J</span>
        <span className="brand-name">Janus</span>
      </div>

      <nav className="app-sidebar-nav">
        <button className="nav-item active">
          <GridIcon /> <span>Dashboard</span>
        </button>
        <button className="nav-item">
          <PeopleIcon /> <span>People</span>
        </button>
        <button className="nav-item">
          <DoorIcon /> <span>Rooms</span>
        </button>
        <button className="nav-item">
          <EquipmentIcon /> <span>Equipment</span>
        </button>
        <button className="nav-item" onClick={onSync}>
          <SettingsIcon /> <span>Sync Data</span>
        </button>
      </nav>

      <div className="app-sidebar-footer">
        <span className="footer-version">Janus v3.4</span>
        <span className="footer-status">All systems operational</span>
      </div>
    </aside>
  );
}
