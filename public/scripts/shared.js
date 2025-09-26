// Shared helpers for all demo pages
export function getCtx() {
  const org = localStorage.getItem("rops.org") || "home-office-biometrics";
  const project = localStorage.getItem("rops.project") || "demo";
  const study = localStorage.getItem("rops.study") || "demo";
  const user = localStorage.getItem("rops.user") || "you@homeoffice.gov.uk";
  return { org, project, study, user };
}
export function setCtx({ org, project, study, user }) {
  if (org) localStorage.setItem("rops.org", org);
  if (project) localStorage.setItem("rops.project", project);
  if (study) localStorage.setItem("rops.study", study);
  if (user) localStorage.setItem("rops.user", user);
}
export function formatDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
