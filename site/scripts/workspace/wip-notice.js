// The WORKSPACE's work-in-progress warning: a modal dialog, shown once per tab (sessionStorage). The button in
// the header opens it again. Loaded before workspace.js, which uses wipNoticeIsOpen.

const wipNoticeKey = 'medsyntaxqa-wip-notice-seen';
const wipNotice = document.getElementById('wip-notice');

function wipNoticeIsOpen() {
    return wipNotice.open;
}

function wipNoticeSeen() {
    try {
        return sessionStorage.getItem(wipNoticeKey) === 'yes';
    } catch (error) { // storage is blocked: show it
        return false;
    }
}

function markWipNoticeSeen() {
    try {
        sessionStorage.setItem(wipNoticeKey, 'yes');
    } catch (error) {
        // storage is blocked: it shows again on the next load
    }
}

// The close event comes a moment later, so also on the button (submit) and Escape (cancel) themselves.
['submit', 'cancel', 'close'].forEach((type) => wipNotice.addEventListener(type, markWipNoticeSeen));

document.getElementById('show-wip-notice').addEventListener('click', () => wipNotice.showModal());

if (!wipNoticeSeen()) {
    wipNotice.showModal();
}
