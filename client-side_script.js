class HierarchyTable {
    constructor() {
        this.nodesMap = {};
        this.selectedKey = null;
        this.loadHierarchy();
        this.nodeData = null;
    }

    async loadHierarchy() {
        try {
            const response = await fetch('heirarchy_kpitest2.json');
            const payload = await response.json();
            // Handle either a raw array or a wrapped object { data: [...] }
            this.nodeData = payload;
            const data = Array.isArray(payload) ? payload : (payload && payload.data) ? payload.data : payload;
            this.renderTree(data);
        } catch (error) {
            console.error('Error loading hierarchy:', error);
        }
    }

    buildTree(flat) {
        // Build map of nodes
        const nodes = {};
        flat.forEach(item => {
            const key = String(item.key != null ? item.key : item.DT_RowId);
            nodes[key] = Object.assign({}, item, { key, children: [] });
        });

        const roots = [];
        flat.forEach(item => {
            const key = String(item.key != null ? item.key : item.DT_RowId);
            const parentRaw = item.parent;
            const parentKey = parentRaw === 0 || parentRaw === '0' || parentRaw == null ? null : String(parentRaw);
            const node = nodes[key];
            if (parentKey && nodes[parentKey]) {
                nodes[parentKey].children.push(node);
            } else {
                roots.push(node);
            }
        });
        // expose node map for edit operations
        this.nodesMap = nodes;
        window.__nodesMap = nodes;
        return roots;
    }

    renderTree(data) {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        // If we received a flat array with `parent` keys, convert to nested children
        let tree = data;
        if (Array.isArray(data) && data.length && data[0].parent !== undefined) {
            tree = this.buildTree(data);
        }

        const addRow = (item, depth = 0, parentKey = null) => {
            const row = document.createElement('tr');
            row.dataset.key = String(item.key != null ? item.key : item.DT_RowId);
            if (parentKey !== null) row.dataset.parent = String(parentKey);
            if (depth > 0) row.classList.add('hidden');

            const nameTd = document.createElement('td');
            nameTd.classList.add('nested-cell');
            nameTd.style.setProperty('--depth', depth);

            const hasChildren = item.children && item.children.length > 0;
            if (hasChildren) {
                const toggle = document.createElement('span');
                toggle.className = 'toggle';
                toggle.textContent = '▶';
                toggle.addEventListener('click', (e) => this.toggleRow(e));
                nameTd.appendChild(toggle);
            } else {
                const spacer = document.createElement('span');
                spacer.classList.add('spacer');
                nameTd.appendChild(spacer);
            }

            nameTd.appendChild(document.createTextNode(' ' + (item.name || '')));
            const valueTd = document.createElement('td');
            valueTd.textContent = item.value != null ? item.value : '';

            row.appendChild(nameTd);
            row.appendChild(valueTd);
            // attach select handler (clicking row selects it)
            row.addEventListener('click', (e) => this.selectRow(e));
            tbody.appendChild(row);

            if (hasChildren) {
                item.children.forEach(child => addRow(child, depth + 1, row.dataset.key));
            }
        };

        if (Array.isArray(tree)) {
            tree.forEach(item => addRow(item, 0, null));
        } else if (tree) {
            addRow(tree, 0, null);
        }
    }

    toggleRow(event) {
        event.stopPropagation();
        const toggle = event.currentTarget;
        const tr = toggle.closest('tr');
        const key = tr && tr.dataset && tr.dataset.key;
        if (!key) return;
        const opening = toggle.textContent === '▶';
        // flip glyph
        toggle.textContent = opening ? '▼' : '▶';
        this.setVisibility(key, opening);
    }

    selectRow(event) {
        const tr = event.currentTarget;
        const key = tr.dataset && tr.dataset.key;
        if (!key) return;
        // clear previous selection
        document.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        this.selectedKey = key;
        // enable edit button
        const editBtn = document.getElementById('editBtn');
        if (editBtn) editBtn.disabled = false;
    }

    openEdit() {
        if (!this.selectedKey) return;
        const node = this.nodesMap[this.selectedKey];
        if (!node) return;
        document.getElementById('editName').value = node.name || '';
        document.getElementById('editValue').value = node.value != null ? node.value : '';
        const editModalEl = document.getElementById('editModal');
        const bsModal = new bootstrap.Modal(editModalEl);
        bsModal.show();

        // attach save handler once
        const saveBtn = document.getElementById('saveEditBtn');
        const saveHandler = () => {
            const newName = document.getElementById('editName').value;
            const newValue = document.getElementById('editValue').value;
            this.saveEdit(this.selectedKey, newName, newValue);
            bsModal.hide();
            saveBtn.removeEventListener('click', saveHandler);
        };
        saveBtn.addEventListener('click', saveHandler);
    }

    saveEdit(key, newName, newValue) {
        const node = this.nodesMap[key];
        if (node) {
            node.name = newName;
            node.value = newValue;
        }
        // update DOM row
        const tr = document.querySelector(`tr[data-key="${key}"]`);
        if (tr) {
            const nameTd = tr.querySelector('td:first-child');
            if (nameTd && nameTd.lastChild && nameTd.lastChild.nodeType === Node.TEXT_NODE) {
                nameTd.lastChild.nodeValue = ' ' + newName;
            }
            const valTd = tr.querySelector('td:nth-child(2)');
            if (valTd) valTd.textContent = newValue;
        }
    }

    setVisibility(parentKey, show) {
        const children = Array.from(document.querySelectorAll(`tr[data-parent="${parentKey}"]`));
        children.forEach(child => {
            if (show) {
                child.classList.remove('hidden');
            } else {
                child.classList.add('hidden');
                // recursively hide grandchildren and reset their toggles
                const childKey = child.dataset.key;
                const nestedToggle = child.querySelector('.toggle');
                if (nestedToggle) nestedToggle.textContent = '▶';
                this.setVisibility(childKey, false);
            }
        });
    }

    expandAll() {
        // show all rows that have a parent
        document.querySelectorAll('tr[data-parent]').forEach(r => r.classList.remove('hidden'));
        // set all toggles to open
        document.querySelectorAll('.toggle').forEach(t => t.textContent = '▼');
    }

    collapseAll() {
        // hide all non-root rows
        document.querySelectorAll('tr[data-parent]').forEach(r => r.classList.add('hidden'));
        // reset all toggles to closed
        document.querySelectorAll('.toggle').forEach(t => t.textContent = '▶');
    }

    validateAggregateSum(key) {
        const node = this.nodesMap[key];
        if (!node || !node.children || node.children.length === 0) {
            return true; // No children to validate, consider valid
        }
        const sum = node.children.reduce((acc, child) => {
            const val = parseFloat(child.value) || 0;
            return acc + val;
        }, 0);
        const parentVal = parseFloat(node.value) || 0;
        return sum === parentVal;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1) Construct HierarchyTable
    const hierarchyTable = new HierarchyTable();
    console.log(hierarchyTable.nodesMap);
    console.log(hierarchyTable.validateAggregateSum(4));

    // 2) Build table (already done in constructor via loadHierarchy)

    // 3) Set togglers for expand/collapse buttons
    const expandAllBtn = document.getElementById('expandAllBtn');
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    const editBtn = document.getElementById('editBtn');

    if (expandAllBtn) {
        expandAllBtn.addEventListener('click', () => hierarchyTable.expandAll());
    }
    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', () => hierarchyTable.collapseAll());
    }
    if (editBtn) {
        editBtn.addEventListener('click', () => hierarchyTable.openEdit());
    }
});