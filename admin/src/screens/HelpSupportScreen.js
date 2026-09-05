import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Bug,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  MessageCircle,
  Play,
  Search,
  X,
} from 'lucide-react';

const SUPPORT_ITEMS = [
  { id: 'faqs', label: 'FAQs & Guides', icon: BookOpen },
  { id: 'contact', label: 'Contact Support', icon: MessageCircle },
  { id: 'problem', label: 'Report a Problem', icon: Bug },
  { id: 'manual', label: 'User Manual', icon: FileText },
  { id: 'videos', label: 'Video Tutorials', icon: Play },
  { id: 'about', label: 'About CCMMS', icon: Info },
];

const PANEL_COPY = {
  faqs: {
    title: 'FAQs & Guides',
    body: 'Use CCMMS to submit complaints, track status, review work orders, approve completed work and view reports. If an issue is not updating, refresh the page and check your internet connection.',
  },
  manual: {
    title: 'User Manual',
    body: 'Open the section you need from the bottom navigation. Use Home for overview, Work Approvals and Work Orders for maintenance workflow, Assign for routing complaints, Reports for analytics, and My Profile for account settings.',
  },
  videos: {
    title: 'Video Tutorials',
    body: 'Video tutorials can be added here later. For now, use FAQs & Guides or Contact Support for help with any CCMMS feature.',
  },
  about: {
    title: 'About CCMMS',
    body: 'CCMMS is the Campus Complaint & Maintenance Management System for reporting, assigning, tracking and resolving campus maintenance issues.',
  },
};

export function HelpSupportScreen({ onBack, onNotifications }) {
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState(null);

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return SUPPORT_ITEMS;
    return SUPPORT_ITEMS.filter((item) => item.label.toLowerCase().includes(term));
  }, [query]);

  const openMail = (subject) => {
    const body = encodeURIComponent('Hello CCMMS Support,\n\nPlease help me with: ');
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;
  };

  const handleItem = (id) => {
    if (id === 'contact') {
      openMail('CCMMS Support Request');
      return;
    }
    if (id === 'problem') {
      openMail('CCMMS Problem Report');
      return;
    }
    setPanel(id);
  };

  const chatWithSupport = () => {
    const text = encodeURIComponent('Hello CCMMS Support, I need help with CCMMS.');
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="help-support-page">
      <header className="help-support-header">
        <button type="button" className="help-support-back" onClick={onBack} aria-label="Back to profile">
          <ArrowLeft size={29}/>
        </button>
        <h1>Help &amp; Support</h1>
        <button type="button" className="help-support-bell" onClick={onNotifications} aria-label="Open notifications">
          <Bell size={26} fill="currentColor"/>
        </button>
      </header>

      <section className="help-support-hero">
        <HelpCircle className="help-support-question" size={86} strokeWidth={2.1}/>
        <h2>How can we help you?</h2>
      </section>

      <label className="help-support-search">
        <Search size={25}/>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help articles..."
          aria-label="Search help articles"
        />
      </label>

      <section className="help-support-menu" aria-label="Help and support options">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className="help-support-row" onClick={() => handleItem(id)}>
            <span className="help-support-row-icon"><Icon size={25}/></span>
            <span className="help-support-row-label">{label}</span>
            <ChevronRight size={25}/>
          </button>
        ))}
        {items.length === 0 && (
          <div className="help-support-empty">No help article found for “{query}”.</div>
        )}
      </section>

      <button type="button" className="help-support-chat" onClick={chatWithSupport}>
        <MessageCircle size={27} fill="currentColor"/>
        <span>Chat with Support</span>
      </button>

      {panel && PANEL_COPY[panel] && (
        <div className="help-support-modal-layer" onClick={() => setPanel(null)}>
          <section className="help-support-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="help-support-modal-close" onClick={() => setPanel(null)} aria-label="Close">
              <X size={20}/>
            </button>
            <h3>{PANEL_COPY[panel].title}</h3>
            <p>{PANEL_COPY[panel].body}</p>
          </section>
        </div>
      )}
    </div>
  );
}
