async function getAllTabGroups() {
    let tabGroups = await chrome.tabGroups.query({});
    return tabGroups;
}

async function getAllTabGroupTabs(tabGroupId) {
    let tabGroupTabs = await chrome.tabs.query({
        groupId: tabGroupId,
    });
    return tabGroupTabs;
}
async function getAllTabGroupsWithTabs() {
    let tabGroups = await getAllTabGroups();
    tabGroups = await Promise.all(
        tabGroups.map(async (tabGroup) => {
            let tabGroupTabs = await getAllTabGroupTabs(tabGroup.id);
            tabGroup.tabs = tabGroupTabs;
            return tabGroup;
        })
    );
    return tabGroups;
}
var main = {
    tabGroups: [],
    saveCurrentButton: document.getElementById("saveCurrent"),
    resetFromCurrentButton: document.getElementById("resetFromCurrent"),
    init: async function () {
        return (await (await this.getSyncData()).render(this.tabGroups)).listen();
    },
    getSyncData: async function () {
        // get saved tabGroups from sync storage
        this.tabGroups = ((await chrome.storage.local.get("tabGroups")) || {}).tabGroups || [];
        return this;
    },
    render: async function (tabGroups) {
        let currentTabGroups = await getAllTabGroupsWithTabs();
        let tabGroupsContainer = document.getElementById("tabGroupsContainer");
        tabGroupsContainer.innerHTML = "";
        tabGroups.forEach((tabGroup) => {
            let tabGroupElement = document.createElement("div");
            let isOpenned = currentTabGroups.find((currentTabGroup) => currentTabGroup.title == tabGroup.title) != null;
            tabGroupElement.classList.add("tab-group");
            tabGroupElement.classList.add(tabGroup.color);
            if (isOpenned) tabGroupElement.classList.add("disabled");
            tabGroupElement.innerHTML = `${tabGroup.title}`;
            tabGroupsContainer.appendChild(tabGroupElement);
            tabGroupElement.onclick = () => {
                this.openTabGroup(tabGroup);
                tabGroupElement.classList.add("disabled");
            };
        });
        return this;
    },
    openTabGroup: async function (tabGroup) {
        let tabGroupTabs = tabGroup.tabs || [];
        let new_tabs = await Promise.all(
            tabGroupTabs.map(
                async (tab) =>
                    await chrome.tabs.create({
                        active: false,
                        url: tab.url,
                    })
            )
        );
        chrome.tabGroups.move(
            (
                await chrome.tabGroups.update(
                    await chrome.tabs.group({
                        tabIds: new_tabs.map((tab) => tab.id),
                    }),
                    {
                        title: tabGroup.title,
                        color: tabGroup.color,
                        collapsed: true,
                    }
                )
            ).id,
            {
                index: 0,
            }
        );
    },
    normalizeTabGroup: function (tabGroups) {
        return tabGroups.map((tabGroup, i) => ({
            collapsed: true,
            color: tabGroup.color,
            title: tabGroup.title,
            tabs: tabGroup.tabs.map((tab) => {
                tab = { url: tab.url, title: tab.title, active: false };
                return tab;
            }),
        }));
    },
    getNewtabGroups: function (tabGroups) {
        let oldTabGroups = this.tabGroups;
        return tabGroups.filter((tabGroup) => {
            return !oldTabGroups.find((oldTabGroup) => {
                return oldTabGroup.title === tabGroup.title;
            });
        });
    },
    removeDuplicateTabGroups: function (tabGroups) {
        return tabGroups.reduce((acc, tabGroup) => {
            !acc.find((accTabGroup) => {
                return accTabGroup.title === tabGroup.title;
            }) && acc.push(tabGroup);
            return acc;
        }, []);
    },
    listen: function () {
        this.saveCurrentButton.addEventListener("click", async () => {
            let oldTabGroups = this.tabGroups;
            // normalize tabGroups
            let news = this.getNewtabGroups(await this.normalizeTabGroup(await getAllTabGroupsWithTabs()));
            // save tabGroups to sync storage
            await chrome.storage.local.set({ tabGroups: (this.tabGroups = this.removeDuplicateTabGroups([...oldTabGroups, ...news])) });
            this.render(this.tabGroups);
        });
        this.resetFromCurrentButton.addEventListener("click", async () => {
            // normalize tabGroups
            let normalized = this.normalizeTabGroup(await getAllTabGroupsWithTabs());
            // save tabGroups to sync storage
            await chrome.storage.local.set({ tabGroups: (this.tabGroups = this.removeDuplicateTabGroups(normalized)) });
            this.render(this.tabGroups);
        });
    },
}.init();
