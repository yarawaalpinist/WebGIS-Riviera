/* =========================================================
   GEOPORTAL — script.js
   Mapa, mapas-base, upload de GeoJSON, menu hierárquico,
   controle de opacidade e legenda dinâmica.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- 1. Inicialização do mapa ---------- */
  // Foco inicial: Riviera de São Lourenço, Bertioga, SP, Brasil
  const INITIAL_VIEW = { lat: -23.793, lng: -46.027, zoom: 13.5 };

  const map = L.map('map', {
    center: [INITIAL_VIEW.lat, INITIAL_VIEW.lng],
    zoom: INITIAL_VIEW.zoom,
    zoomControl: false,
    attributionControl: true,
  });

  /* ---------- 2. Mapas base ---------- */
  const baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }),
    satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: 'Imagery &copy; Google',
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }),
    topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, HERE, TomTom, USGS, Intermap, and others',
      maxZoom: 19,
    }),
  };
  
  baseLayers.osm.addTo(map);
  let activeBase = 'osm';

  document.querySelectorAll('.basemap-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.base;
      if (key === activeBase) return;
      map.removeLayer(baseLayers[activeBase]);
      baseLayers[key].addTo(map);
      activeBase = key;
      document.querySelectorAll('.basemap-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ---------- 3. Sidebar: colapsar / reabrir ---------- */
  const sidebar = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse');
  const reopenBtn = document.getElementById('sidebar-reopen');

  collapseBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    reopenBtn.classList.add('visible');
  });
  reopenBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    reopenBtn.classList.remove('visible');
  });

  /* ---------- 4. Toolbar (zoom / locate / reset) ---------- */
  document.getElementById('btn-zoom-in').addEventListener('click', () => map.zoomIn());
  document.getElementById('btn-zoom-out').addEventListener('click', () => map.zoomOut());
  document.getElementById('btn-reset').addEventListener('click', () => {
    map.setView([INITIAL_VIEW.lat, INITIAL_VIEW.lng], INITIAL_VIEW.zoom);
  });
  document.getElementById('btn-locate').addEventListener('click', () => {
    map.locate({ setView: true, maxZoom: 16 });
  });
  map.on('locationerror', () => alert('Não foi possível obter sua localização.'));

  /* ---------- 5. HUD: coordenadas, zoom e escala ---------- */
  const hudLat = document.getElementById('hud-lat');
  const hudLon = document.getElementById('hud-lon');
  const hudZoom = document.getElementById('hud-zoom');
  const hudScale = document.getElementById('hud-scale');

  function updateScale() {
    const center = map.getSize().y / 2;
    const p1 = map.containerPointToLatLng([0, center]);
    const p2 = map.containerPointToLatLng([100, center]);
    const meters = map.distance(p1, p2);
    hudScale.textContent = meters >= 1000
      ? `${(meters / 1000).toFixed(1)} km / 100px`
      : `${Math.round(meters)} m / 100px`;
  }

  map.on('mousemove', (e) => {
    hudLat.textContent = e.latlng.lat.toFixed(5);
    hudLon.textContent = e.latlng.lng.toFixed(5);
  });
  map.on('zoomend moveend', () => {
    hudZoom.textContent = map.getZoom();
    updateScale();
  });
  hudZoom.textContent = map.getZoom();
  updateScale();

  /* ---------- 6. Estrutura de categorias de camadas ---------- */
  const GROUP_DEFS = {
    limites: { label: 'Limites Administrativos', key: 'limites' },
    hidrografia: { label: 'Hidrografia', key: 'hidrografia' },
    mobilidade: { label: 'Mobilidade', key: 'mobilidade' },
    infraestrutura: { label: 'Infraestrutura', key: 'infraestrutura' },
    vegetacao: { label: 'Plantio e Vegetação', key: 'vegetacao' },
    importadas: { label: 'Camadas Importadas', key: 'importadas' },
  };

  const PALETTE = [
    '#22D3EE', // Cyan
    '#F2B84B', // Amber
    '#A78BFA', // Violet
    '#4ADE80', // Emerald
    '#F472B6', // Pink
    '#FB7185', // Rose
    '#38BDF8', // Sky
    '#FB923C', // Orange
    '#60A5FA', // Blue
  ];

  const layerStore = {
    limites: [],
    hidrografia: [],
    mobilidade: [],
    infraestrutura: [],
    vegetacao: [],
    importadas: [],
  };

  let colorCursor = 0;
  let layerIdCounter = 0;

  const layersTreeEl = document.getElementById('layers-tree');
  const layerCountEl = document.getElementById('layer-count');

  function nextColor() {
    const c = PALETTE[colorCursor % PALETTE.length];
    colorCursor += 1;
    return c;
  }

  function dominantGeometryType(geojson) {
    const feats = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
    const first = feats.find((f) => f && f.geometry) || {};
    const t = (first.geometry && first.geometry.type) || 'Point';
    if (t.includes('Polygon')) return 'polygon';
    if (t.includes('LineString')) return 'line';
    return 'point';
  }

  /* Opacidade universal para feições do Leaflet */
  function setLayerOpacity(leafletLayer, val) {
    leafletLayer.eachLayer((layer) => {
      if (typeof layer.setOpacity === 'function') {
        layer.setOpacity(val);
      } else if (typeof layer.setStyle === 'function') {
        const isPolygon = layer instanceof L.Polygon;
        layer.setStyle({
          opacity: val,
          fillOpacity: isPolygon ? val * 0.35 : val * 0.15,
        });
      }
    });
  }

  function addGeoJsonToMap(name, geojson, categoryKey = 'importadas', active = true) {
    const groupKey = dominantGeometryType(geojson);
    const color = nextColor();
    const id = `layer-${layerIdCounter++}`;

    const leafletLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 5.5,
          color: color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.6,
        }),
      style: () => ({
        color: color,
        weight: groupKey === 'polygon' ? 1.5 : groupKey === 'line' ? 2.5 : 2,
        fillColor: color,
        fillOpacity: groupKey === 'polygon' ? 0.25 : 0.1,
      }),
      onEachFeature: (feature, layer) => {
        if (feature.properties && Object.keys(feature.properties).length) {
          const rows = Object.entries(feature.properties)
            .map(([k, v]) => {
              let valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
              if (valStr === null || valStr === undefined) valStr = '—';
              return `<tr><td class="popup-key">${k}</td><td class="popup-val">${valStr}</td></tr>`;
            })
            .join('');
          layer.bindPopup(`
            <div class="popup-title">${name}</div>
            <table class="popup-table">
              <tbody>${rows}</tbody>
            </table>
          `, { maxWidth: 300 });
        }
      },
    });

    if (active) {
      leafletLayer.addTo(map);
    }

    layerStore[categoryKey].push({
      id,
      name,
      color,
      leafletLayer,
      visible: active,
      opacity: 1.0,
      geometryType: groupKey,
    });

    renderLayersTree();
    updateLegend();
  }

  function removeLayerById(categoryKey, id) {
    const idx = layerStore[categoryKey].findIndex((l) => l.id === id);
    if (idx === -1) return;
    map.removeLayer(layerStore[categoryKey][idx].leafletLayer);
    layerStore[categoryKey].splice(idx, 1);
    renderLayersTree();
    updateLegend();
  }

  function toggleLayerVisibility(categoryKey, id, visible) {
    const item = layerStore[categoryKey].find((l) => l.id === id);
    if (!item) return;
    item.visible = visible;
    if (visible) {
      item.leafletLayer.addTo(map);
      setLayerOpacity(item.leafletLayer, item.opacity);
    } else {
      map.removeLayer(item.leafletLayer);
    }
    updateLegend();
  }

  function renderLayersTree() {
    let totalCount = 0;
    Object.keys(layerStore).forEach((key) => {
      totalCount += layerStore[key].length;
    });

    layerCountEl.textContent = `${totalCount} camada${totalCount === 1 ? '' : 's'} carregada${totalCount === 1 ? '' : 's'}`;

    if (totalCount === 0) {
      layersTreeEl.innerHTML = '<p class="layers-empty">Nenhuma camada carregada ainda. Envie um arquivo GeoJSON abaixo.</p>';
      return;
    }

    layersTreeEl.innerHTML = '';
    Object.values(GROUP_DEFS).forEach(({ label, key }) => {
      const items = layerStore[key];
      if (!items.length) return;

      const groupEl = document.createElement('div');
      groupEl.className = 'layer-group open';

      const head = document.createElement('div');
      head.className = 'layer-group-head';
      head.innerHTML = `
        <span class="layer-group-caret">▶</span>
        <span class="layer-group-title">${label}</span>
        <span class="layer-group-count">${items.length}</span>`;
      head.addEventListener('click', () => groupEl.classList.toggle('open'));
      groupEl.appendChild(head);

      const itemsWrap = document.createElement('div');
      itemsWrap.className = 'layer-group-items';

      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'layer-item';
        
        row.innerHTML = `
          <div class="layer-item-main">
            <input type="checkbox" class="layer-checkbox" ${item.visible ? 'checked' : ''} />
            <span class="layer-color-dot" style="background:${item.color}"></span>
            <span class="layer-name" title="${item.name}">${item.name}</span>
            <span class="layer-actions">
              <button class="layer-icon-btn zoom-to" title="Centralizar">⌖</button>
              <button class="layer-icon-btn remove" title="Remover">✕</button>
            </span>
          </div>
          <div class="layer-item-opacity">
            <span class="layer-opacity-label">Opacidade: ${Math.round(item.opacity * 100)}%</span>
            <input type="range" class="layer-opacity-slider" min="0" max="100" value="${Math.round(item.opacity * 100)}" />
          </div>`;

        row.querySelector('.layer-checkbox').addEventListener('change', (e) => {
          toggleLayerVisibility(key, item.id, e.target.checked);
        });
        
        row.querySelector('.layer-opacity-slider').addEventListener('input', (e) => {
          const val = parseFloat(e.target.value) / 100;
          row.querySelector('.layer-opacity-label').textContent = `Opacidade: ${e.target.value}%`;
          item.opacity = val;
          setLayerOpacity(item.leafletLayer, val);
        });

        row.querySelector('.zoom-to').addEventListener('click', () => {
          try {
            const b = item.leafletLayer.getBounds();
            if (b.isValid()) map.fitBounds(b, { padding: [40, 40] });
          } catch (err) {
            alert('Não foi possível centralizar nesta camada.');
          }
        });
        row.querySelector('.remove').addEventListener('click', () => removeLayerById(key, item.id));

        itemsWrap.appendChild(row);
      });

      groupEl.appendChild(itemsWrap);
      layersTreeEl.appendChild(groupEl);
    });
  }

  /* ---------- 7. Legenda Dinâmica ---------- */
  function updateLegend() {
    const legendBody = document.getElementById('legend-body');
    if (!legendBody) return;

    legendBody.innerHTML = '';
    let hasActiveLayers = false;

    Object.keys(layerStore).forEach((catKey) => {
      layerStore[catKey].forEach((item) => {
        if (item.visible) {
          hasActiveLayers = true;

          const legendItem = document.createElement('div');
          legendItem.className = 'legend-item';

          let symbolClass = 'polygon';
          if (item.geometryType === 'point') symbolClass = 'point';
          else if (item.geometryType === 'line') symbolClass = 'line';

          const symbolStyle = item.geometryType === 'line'
            ? `background: ${item.color};`
            : `background: ${item.color}33; border-color: ${item.color};`;

          legendItem.innerHTML = `
            <span class="legend-symbol ${symbolClass}" style="${symbolStyle}"></span>
            <span class="legend-label" title="${item.name}">${item.name}</span>
          `;
          legendBody.appendChild(legendItem);
        }
      });
    });

    if (!hasActiveLayers) {
      legendBody.innerHTML = '<p style="font-size: 11px; color: var(--text-faint); margin: 0;">Nenhuma camada visível.</p>';
    }
  }

  /* Configuração do colapso da legenda */
  const legendPanel = document.getElementById('legend-panel');
  const legendToggleBtn = document.getElementById('btn-legend-toggle');

  if (legendToggleBtn && legendPanel) {
    legendToggleBtn.addEventListener('click', () => {
      legendPanel.classList.toggle('collapsed');
      legendToggleBtn.textContent = legendPanel.classList.contains('collapsed') ? '+' : '−';
    });
  }

  /* ---------- 8. Validador WGS-84 (EPSG:4326) ---------- */
  function isGeoJSONInWGS84(geojson) {
    let isWGS84 = true;
    const sampleCoordinates = [];

    function extractCoordinates(coords) {
      if (Array.isArray(coords)) {
        if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          sampleCoordinates.push(coords);
        } else {
          coords.forEach(extractCoordinates);
        }
      }
    }

    const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
    for (const f of features) {
      if (f.geometry && f.geometry.coordinates) {
        extractCoordinates(f.geometry.coordinates);
      }
      if (sampleCoordinates.length > 100) break;
    }

    for (const pt of sampleCoordinates) {
      const lon = pt[0];
      const lat = pt[1];
      // Coordenadas WGS-84 válidas: Longitude (-180 a 180) e Latitude (-90 a 90)
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        isWGS84 = false;
        break;
      }
    }

    return isWGS84;
  }

  /* ---------- 9. Leitura de arquivos GeoJSON ---------- */
  function readFileAsGeoJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (err) {
          reject(new Error(`"${file.name}" não é um JSON válido.`));
        }
      };
      reader.onerror = () => reject(new Error(`Falha ao ler "${file.name}".`));
      reader.readAsText(file);
    });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => /\.(geojson|json)$/i.test(f.name));
    for (const file of files) {
      try {
        const data = await readFileAsGeoJson(file);
        
        if (!isGeoJSONInWGS84(data)) {
          alert(`Erro: O arquivo "${file.name}" não parece estar em WGS-84 (EPSG:4326).\n\nWebGIS requer coordenadas geográficas em graus decimais (Latitude entre -90 e 90, Longitude entre -180 e 180). Por favor, reprojete os dados antes de importar.`);
          continue;
        }

        addGeoJsonToMap(file.name.replace(/\.(geojson|json)$/i, ''), data, 'importadas', true);
        
        // Foca automaticamente no novo dado carregado
        const lastGroup = layerStore.importadas;
        if (lastGroup.length > 0) {
          const lastLayer = lastGroup[lastGroup.length - 1].leafletLayer;
          const bounds = lastLayer.getBounds();
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (err) {
        alert(err.message);
      }
    }
  }

  /* ---------- 10. Dropzone + input de arquivo ---------- */
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  /* ---------- 11. Abrir pasta local (File System Access API) ---------- */
  const folderBtn = document.getElementById('btn-open-folder');
  const folderHint = document.getElementById('folder-hint');

  if (!window.showDirectoryPicker) {
    folderBtn.disabled = true;
    folderBtn.style.opacity = '0.45';
    folderBtn.style.cursor = 'not-allowed';
    folderHint.textContent = 'Recurso não suportado neste navegador. Use o botão de upload acima (funciona em qualquer navegador).';
  } else {
    folderBtn.addEventListener('click', async () => {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const geoFiles = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && /\.(geojson|json)$/i.test(entry.name)) {
            geoFiles.push(await entry.getFile());
          }
        }
        if (!geoFiles.length) {
          alert('Nenhum arquivo .geojson encontrado nessa pasta.');
          return;
        }
        handleFiles(geoFiles);
      } catch (err) {
        if (err.name !== 'AbortError') alert('Não foi possível abrir a pasta selecionada.');
      }
    });
  }

  /* ---------- 12. Carregamento Automático de Camadas Locais ---------- */
  const AUTO_LAYERS = [
    { file: 'Limites_riviera.geojson', name: 'Limites da Riviera', category: 'limites', active: true },
    { file: 'Modulos_riviera.geojson', name: 'Módulos da Riviera', category: 'limites', active: true },
    { file: 'Bacias_de_contribuicao.geojson', name: 'Bacias de Contribuição', category: 'hidrografia', active: false },
    { file: 'Hidrografia.geojson', name: 'Hidrografia', category: 'hidrografia', active: false },
    { file: 'Paleohidrografia.geojson', name: 'Paleohidrografia', category: 'hidrografia', active: false },
    { file: 'Ruas.geojson', name: 'Ruas', category: 'mobilidade', active: true },
    { file: 'Ciclovias.geojson', name: 'Ciclovias', category: 'mobilidade', active: true },
    { file: 'Rede_eletrica.geojson', name: 'Rede Elétrica', category: 'infraestrutura', active: false },
    { file: 'Inventario_florestal.geojson', name: 'Inventário Florestal', category: 'vegetacao', active: false },
    { file: 'Vagas_verdes.geojson', name: 'Vagas Verdes', category: 'vegetacao', active: false },
    { file: 'Possiveis_espacos_plantio.geojson', name: 'Possíveis Espaços de Plantio', category: 'vegetacao', active: false },
    { file: 'Inventario_de_arvores_filtrado.geojson', name: 'Inventário de Árvores (Filtrado)', category: 'vegetacao', active: false },
    { file: 'Inventario_de_arvores.geojson', name: 'Inventário de Árvores (Completo - 12MB)', category: 'vegetacao', active: false },
  ];

  async function loadAutoLayers() {
    let combinedBounds = L.latLngBounds();
    let loadedCount = 0;

    for (const l of AUTO_LAYERS) {
      try {
        const response = await fetch(`../GeoJSON/${l.file}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        // Adiciona à árvore de camadas
        addGeoJsonToMap(l.name, data, l.category, l.active);
        
        if (l.active) {
          const lastGroup = layerStore[l.category];
          const lastLayer = lastGroup[lastGroup.length - 1].leafletLayer;
          const bounds = lastLayer.getBounds();
          if (bounds.isValid()) {
            combinedBounds.extend(bounds);
            loadedCount++;
          }
        }
      } catch (err) {
        console.warn(`Não foi possível pré-carregar a camada "${l.name}" de ../GeoJSON/${l.file}:`, err);
      }
    }

    // Centraliza o mapa nas camadas carregadas e ativas na inicialização
    if (loadedCount > 0 && combinedBounds.isValid()) {
      map.fitBounds(combinedBounds, { padding: [40, 40] });
    }
  }

  // Executa o carregamento automático inicial
  loadAutoLayers();
  renderLayersTree();
  updateLegend();

})();