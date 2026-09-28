import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  description?: ReactNode;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

/** A section that can be collapsed down to just its title and description, hiding the
 *  (often long) table/form content below. Used on the manager console so a manager can
 *  tuck away sections they don't need to look at right now. */
export function CollapsibleSection({ title, description, defaultCollapsed = false, children }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>{title}</h2>
        <button onClick={() => setCollapsed((c) => !c)}>{collapsed ? 'Show' : 'Hide'}</button>
      </div>
      {description && <p>{description}</p>}
      {!collapsed && children}
    </section>
  );
}
