// ==UserScript==
// @name         Natural Park Interactive Map
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Script que crea un mapa interactivo para el parque natural Lagunas de la Mata y Torrevieja. Mediante leaflet, se crean el area, las rutas y los centros de informacion del parque natural. Estos datos se extraen leyendo un fichero ".json".
// @author       Francisco Javier García Fernández
// @icon         https://i.ibb.co/CnycPkL/npim-icon.png
// @match        https://parquesnaturales.gva.es/es/web/pn-lagunas-de-la-mata-torrevieja/planea-tu-visita
// @match        https://parquesnaturales.gva.es/es/web/pn-lagunas-de-la-mata-torrevieja/planea-tu-visita*
// @resource     LEAFLET_LIBRARY_CSS  https://unpkg.com/leaflet@1.7.1/dist/leaflet.css
// @require      https://unpkg.com/leaflet@1.7.1/dist/leaflet.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

/*

   ****************************************LICENSE*****************************************

      NPIM is licensed under a Creative Commons Reconocimiento 4.0 Internacional License.

   ****************************************************************************************

*/

(function() {
    'use strict';

    /*****************************************************************CONSTANTES GLOBALES**********************************************************************************/

    const MAX_POPUP_WIDTH_LEAFLET = 300; // Ancho maximo de los pop-ups generados con leaflet
    const LEAFLET_MAP_DEFAULT_ZOOM = 13; // Zoom con el que se observa por defecto el mapa de leaflet

    const DEFAULT_STOP_ICONS = new Array("https://i.ibb.co/0YPGTmv/stop-Flag-0.png", "https://i.ibb.co/r4vTtZs/stop-Flag-1.png", "https://i.ibb.co/KmpZtdG/stop-Flag-2.png",
                                         "https://i.ibb.co/pdBfZMr/stop-Flag-3.png", "https://i.ibb.co/cQBK1B2/stop-Flag-4.png", "https://i.ibb.co/FsPn8TZ/stop-Flag-5.png",
                                         "https://i.ibb.co/2F4HyRW/stop-Flag-6.png", "https://i.ibb.co/YpfSKsD/stop-Flag-7.png", "https://i.ibb.co/Ms9QzrC/stop-Flag-8.png",
                                         "https://i.ibb.co/TTpVpL0/stop-Flag-9.png", "https://i.ibb.co/WnWBZTN/stop-Flag-10.png");

    const GREEN_STOP_ICONS = new Array("https://i.ibb.co/N9CrSDn/stop-Flag-Green-0.png", "https://i.ibb.co/StFyY7q/stop-Flag-Green-1.png", "https://i.ibb.co/L1yFj75/stop-Flag-Green-2.png",
                                       "https://i.ibb.co/K53BTkP/stop-Flag-Green-3.png", "https://i.ibb.co/z7dYpRq/stop-Flag-Green-4.png", "https://i.ibb.co/pL4BR28/stop-Flag-Green-5.png",
                                       "https://i.ibb.co/NtSpjPf/stop-Flag-Green-6.png", "https://i.ibb.co/C7v2rHC/stop-Flag-Green-7.png", "https://i.ibb.co/tCKLs2q/stop-Flag-Green-8.png",
                                       "https://i.ibb.co/2kyyTbF/stop-Flag-Green-9.png", "https://i.ibb.co/DbcgVDn/stop-Flag-Green-10.png");

    const YELLOW_STOP_ICONS = new Array("https://i.ibb.co/vDBrbbq/stop-Flag-Yellow-0.png", "https://i.ibb.co/fkPm481/stop-Flag-Yellow-1.png", "https://i.ibb.co/hC5qZZZ/stop-Flag-Yellow-2.png",
                                        "https://i.ibb.co/BfPQchC/stop-Flag-Yellow-3.png", "https://i.ibb.co/Q9cZSz1/stop-Flag-Yellow-4.png", "https://i.ibb.co/Qmyq8b5/stop-Flag-Yellow-5.png",
                                        "https://i.ibb.co/wLwndKV/stop-Flag-Yellow-6.png", "https://i.ibb.co/f9gGy87/stop-Flag-Yellow-7.png", "https://i.ibb.co/TkCmrXn/stop-Flag-Yellow-8.png",
                                        "https://i.ibb.co/mqYtJ6q/stop-Flag-Yellow-9.png", "https://i.ibb.co/sgwscDr/stop-Flag-Yellow-10.png");

    const RED_STOP_ICONS = new Array("https://i.ibb.co/TbZJRmp/stop-Flag-Red-0.png", "https://i.ibb.co/dmkm4nL/stop-Flag-Red-1.png", "https://i.ibb.co/P64bzVP/stop-Flag-Red-2.png",
                                     "https://i.ibb.co/rwnt9tw/stop-Flag-Red-3.png", "https://i.ibb.co/5vNFBYY/stop-Flag-Red-4.png", "https://i.ibb.co/wS3fq6r/stop-Flag-Red-5.png",
                                     "https://i.ibb.co/LtFGgHn/stop-Flag-Red-6.png", "https://i.ibb.co/Jrn79DM/stop-Flag-Red-7.png", "https://i.ibb.co/m8Bk1ck/stop-Flag-Red-8.png",
                                     "https://i.ibb.co/W6j2vYs/stop-Flag-Red-9.png", "https://i.ibb.co/X2DmK1V/stop-Flag-Red-10.png");

    const STOP_ICONS_COLOR = {"#2B9718": "green", "#FAE10A": "yellow", "#E90C0C": "red"};
    const STOP_ICONS = {"green": GREEN_STOP_ICONS, "yellow": YELLOW_STOP_ICONS, "red": RED_STOP_ICONS, "default": DEFAULT_STOP_ICONS};

    /***************************************************************************************************************************************************************************/

    /**********************************************************************************CLASES***********************************************************************************/

    class Route{
        constructor(id, name, edge, stops){
            this.id = id;
            this.name = name;
            this.edge = edge;
            this.stops = stops;
        }
    };

    class Map{
        constructor(leafletMap, tileLayer, area, routes, infoSites){
            this.leafletMap = leafletMap;
            this.tileLayer = tileLayer;
            this.area = area;
            this.routes = routes;
            this.infoSites = infoSites;
        }
    };

    /*****************************************************************************************************************************************************************************/

    /*******************************************************************************VARIABLES GLOBALES****************************************************************************/

    var map = null; // Objeto de la clase Map que almacena los datos referentes a los objetos creados mediante leaflet para el tratamiento de mapas
    var mapData = null; // Variable utilizada para almacenar los datos del archivo ".json" leido

    /*****************************************************************************************************************************************************************************/

    /****************************************************CREACION DEL MAPA Y ALMACENAMIENTO DEL MISMO EN LA VARIABLE GLOBAL MAP***************************************************/

    function createMapContainer(){
        var mapLoc = document.querySelectorAll("body .nav-menu-style-images")[0];
        var mapContainer = document.createElement("div");
        mapContainer.id = "map";
        mapContainer.style = "width: 60em; height: 65em";
        mapLoc.appendChild(mapContainer);
    }

    function createMap(){
        createMapContainer();
        var leafletMap = L.map('map');
        var tileLayerMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMap);
        map = new Map(leafletMap);
        map.tileLayer = tileLayerMap;
    }

    /*******************************************************************************************************************************************************************************/

    /******************************************************CREACION DE LOS ICONOS QUE SE EMPLEARAN EN EL MAPA COMO MARCADORES*******************************************************/

    function createDefaultIcon(){
        var defaultIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
            iconSize:     [25, 41],
            iconAnchor:   [12.5, 41],
            popupAnchor:  [-3, -41]
        });
        return defaultIcon;
    }

    function createStopIcon(index, markerIcons){
        var stopIcon = null;
        if(index < markerIcons.length){
            stopIcon = L.icon({
                iconUrl: markerIcons[index],
                iconSize:     [36, 42],
                iconAnchor:   [36, 42],
                popupAnchor:  [-3, -42]
            });
        }
        return stopIcon;
    }

    /******************************************************************************************************************************************************************************/

    /*******************************************************RECREACION DE LOS ELEMENTOS MOSTRADOS EN EL MAPA CUANDO EL CHECKBOX SE ACTIVA******************************************/

    function recreateMapInfo(id){
        if(id == "area"){
            createNatParkArea(map.leafletMap, mapData.natPark, mapData.mun, mapData.area);
        }
        else if(id == "infoSites"){
            createInfoSites(map.leafletMap, mapData.infoSites);
        }
        else if(id.includes("route")){
            var routeNum = id.charAt(id.length - 1);
            map.routes.push(createRoute(map.leafletMap, id, mapData.routes[routeNum]));
        }
        console.log(map);
    }

    /*******************************************************************************************************************************************************************************/

    /************************************************DESTRUCCION DE LOS ELEMENTOS MOSTRADOS EN EL MAPA CUANDO EL CHECKBOX SE DESACTIVA**********************************************/

    function removeRouteStops(routeStops){
        for(var i = 0; i < routeStops.length; i++){
            map.leafletMap.removeLayer(routeStops[i]);
        }
    }

    function removeInfoSites(){
        for(var i = 0; i < map.infoSites.length; i++){
            map.leafletMap.removeLayer(map.infoSites[i]);
        }
        map.infoSites = null;
    }

    function destroyMapInfo(id){
        if(id == "area"){
            map.leafletMap.removeLayer(map.area);
            map.area = null;
        }
        else if(id == "infoSites"){
            removeInfoSites();
        }
        else if(id.includes("route")){
            for(var i = 0; i < map.routes.length; i++){
                if(map.routes[i].id == id){
                    removeRouteStops(map.routes[i].stops);
                    map.leafletMap.removeLayer(map.routes[i].edge);
                    map.routes.splice(i, 1);
                    break;
                }
            }
        }
        console.log(map);
    }

    /********************************************************************************************************************************************************************************/

    /**********************FUNCION DONDE SE EVALUA SI EL ELEMENTO DEBE MOSTRARSE O DESTRUIRSE SEGUN EL ESTADO DEL CHECKBOX CON EL QUE HA INTERACTUADO EL USUARIO*********************/

    function changeMapDataVis(value, isActive){
        console.log(value);
        console.log(isActive);
        if(isActive){
            recreateMapInfo(value);
        }
        else{
            destroyMapInfo(value);
        }
    }

    /*********************************************************************************************************************************************************************************/

    /*****************************FUNCIONES UTILIZADAS PARA OTORGAR EL ESTILO CON EL QUE SE VISUALIZARAN EL MAPA Y LA INTERFAZ DE CHECKBOXS DEL SCRIPT********************************/

    function setUIButtonContainerStyle(uiButtonContainer){
        uiButtonContainer.style.display = "table";
        uiButtonContainer.style.backgroundColor = "#D7FADD";
        uiButtonContainer.style.height = "100%";
        uiButtonContainer.style.border = "0.3em solid #72BD22";
        uiButtonContainer.style.borderCollapse = "collapse";
        uiButtonContainer.style.marginLeft = "3%";
    }

    function setUIFormTitleStyle(uiFormTitle){
        uiFormTitle.style.color = "#000000";
        uiFormTitle.style.backgroundColor = "#7AD780";
        uiFormTitle.style.fontSize = "1.3em";
        uiFormTitle.style.textAlign = "center";
        uiFormTitle.style.margin = "0px";
        uiFormTitle.style.marginBottom = "1em";
        uiFormTitle.style.paddingTop = "0.5em";
        uiFormTitle.style.paddingBottom = "0.5em";
        uiFormTitle.style.borderBottom = "0.3em solid #72BD22";
    }

    function setScriptContainerStyle(scriptContainer){
        scriptContainer.style.display = "flex";
        scriptContainer.style.justifyContent = "space-between";
    }

    function setCheckBoxContainerStyle(checkBoxCont){
        checkBoxCont.style.display = "flex";
        checkBoxCont.style.margin = "0.5em";
        checkBoxCont.style.color = "#000000";
    }

    function setCheckBoxStyle(checkBox){
        checkBox.style.marginRight = "0.5em";
        checkBox.onmouseover = function(e){
            var label = this.nextSibling;
            label.style.textDecoration = "underline";
            label.style.fontWeight = "bold";
        };
        checkBox.onmouseout = function(e){
            var label = this.nextSibling;
            label.style.textDecoration = "none";
            label.style.fontWeight = "normal";
        };
    }

    function setCheckBoxLabelStyle(checkBoxLabel){
        checkBoxLabel.onmouseover = function(e){
            this.style.textDecoration = "underline";
            this.style.fontWeight = "bold";
        };
        checkBoxLabel.onmouseout = function(e){
            this.style.textDecoration = "none";
            this.style.fontWeight = "normal";
        };
    }

    /***************************************************************************************************************************************************************************************/

    /**************************FUNCION CON LA QUE SE CREA EL FORM QUE CONTENDRA LOS BOTONES DE UI. TAMBIEN SE CREA EL DIV QUE POSEERA DICHO FORM ADEMAS DEL MAPA****************************/

    function createUIButtonContainer(){
        var mapDom = document.getElementById("map");
        var mapParent = mapDom.parentNode;
        var uiFormTitle = document.createElement("h2");
        uiFormTitle.innerHTML = "NPIM Interface";
        setUIFormTitleStyle(uiFormTitle);
        var scriptContainer = document.createElement("div");
        setScriptContainerStyle(scriptContainer);
        var uiButtonContainer = document.createElement("form");
        uiButtonContainer.id = "uiCont";
        setUIButtonContainerStyle(uiButtonContainer);
        uiButtonContainer.appendChild(uiFormTitle);
        scriptContainer.appendChild(mapDom);
        scriptContainer.appendChild(uiButtonContainer);
        mapParent.appendChild(scriptContainer);
    }

    /***************************************************************************************************************************************************************************************/

    /******************************CREACION DE LOS CHECKBOXS JUNTO CON SUS LABELS ASOCIADOS. CADA UNO ESTARA ENCERRADO EN UN ELEMENTO P DENTRO DEL FORM*************************************/

    function createCheckBoxContainer(){
        var checkBoxCont = document.createElement("p");
        setCheckBoxContainerStyle(checkBoxCont);
        return checkBoxCont;
    }

    function createCheckBox(id, name){
        var checkBox = document.createElement("input");
        checkBox.setAttribute("type", "checkbox");
        if(id != null && id != undefined && id != ""){
            checkBox.id = id;
            checkBox.value = id;
        }
        if(name != null && name != undefined && name != ""){
            checkBox.name = name;
        }
        setCheckBoxStyle(checkBox);
        checkBox.checked = true;
        checkBox.addEventListener("change", function(){changeMapDataVis(this.value, this.checked)}, false);
        return checkBox;
    }

    function createLabel(link, id, value){
        var label = document.createElement("label");
        if(link != null && link != undefined && link != ""){
            label.htmlFor = link;
        }
        if(id != null && id != undefined && id != ""){
            label.id = id;
        }
        if(value != null && value != undefined && value != ""){
            label.appendChild(document.createTextNode(value));
        }
        setCheckBoxLabelStyle(label);
        return label;
    }

    /******************************************************************************************************************************************************************************************/

    /***************************FUNCION EN DONDE SE CREA, EMPLEANDO LAS FUNCIONES DE LA SEPARACION ANTERIOR, EL CHECKBOX CORRESPONDIENTE AL AREA DEL PARQUE NATURAL****************************/

    function createAreaButton(natPark){
        var uiCont = document.getElementById("uiCont");
        var areaCont = createCheckBoxContainer();
        var areaCheck = createCheckBox("area", "natParkArea");
        var areaLabel = createLabel("area", "areaLabel", "Área de " + natPark);
        areaCont.appendChild(areaCheck);
        areaCont.appendChild(areaLabel);
        uiCont.appendChild(areaCont);
    }

    /******************************************************************************************************************************************************************************************/

    /************************FUNCION EN DONDE SE CREAN DINAMICAMENTE, SEGUN LOS DATOS DEL ARCHIVO JSON, LOS CHECKBOXS CORRESPONDIENTES A LAS RUTAS DEL PARQUE NATURAL**************************/

    function createRoutesButtons(routes){
        var uiCont = document.getElementById("uiCont");
        for(var i = 0; i < routes.length; i++){
            var routeCont = createCheckBoxContainer();
            var routeCheck = createCheckBox("route" + i, routes[i].name);
            var routeLabel = createLabel("route" + i, "route" + i + "Label", routes[i].name);
            routeCont.appendChild(routeCheck);
            routeCont.appendChild(routeLabel);
            uiCont.appendChild(routeCont);
        }
    }

    /******************************************************************************************************************************************************************************************/

    /*****************************************FUNCION EN DONDE SE CREA EL CHECKBOX CORRESPONDIENTE A LOS LUGARES DE INFORMACION DEL PARQUE NATURAL*********************************************/

    function createInfoSitesButton(){
        var uiCont = document.getElementById("uiCont");
        var infoSitesCont = createCheckBoxContainer();
        var infoSitesCheck = createCheckBox("infoSites", "natParkInfoSites");
        var infoSitesLabel = createLabel("infoSites", "infoSitesLabel", "Centros de Información");
        infoSitesCont.appendChild(infoSitesCheck);
        infoSitesCont.appendChild(infoSitesLabel);
        uiCont.appendChild(infoSitesCont);
    }

    /*******************************************************************************************************************************************************************************************/

    /*******************************************************FUNCION QUE CREA LA INTERFAZ DE USUARIO EMPLEANDO LAS FUNCIONES ANTERIORES**********************************************************/

    function createUserInterface(){
        createUIButtonContainer();
        createAreaButton(mapData.natPark);
        createRoutesButtons(mapData.routes);
        createInfoSitesButton();
    }

    /********************************************************************************************************************************************************************************************/

    /*******************************************************FUNCIONES EN LAS QUE SE CREA EL TRATAMIENTO DEL EVENTO ONHOVER PARA LOS ELEMENTOS DEL MAPA*******************************************/

    function setBorderHover(polyline){
        polyline.on('mouseover', function(e){
            var layer = e.target;
            layer.setStyle({
                weight: 6
            });
        });
        polyline.on('mouseout', function(e){
            var layer = e.target;
            layer.setStyle({
                weight: 3
            });
        });
    }

    function setMarkerHover(marker){
        marker.on("mouseover", function(e){
            this.openPopup();
        });
        marker.on("mouseout", function(e){
            this.closePopup();
        });
        marker.off("click");
    }

    /*********************************************************************************************************************************************************************************************/

    /**********************************************CREACION DE LOS DIFERENTES POP-UPS QUE SE MOSTRARAN EN EL MAPA SEGUN SE INTERACTUE CON EL MISMO************************************************/

    function createAreaPopUp(natPark, mun, areaValue){
        var popUp = document.createElement("div");
        var title = "<h2>" + natPark + "</h2>";
        var munic = "<br><strong>Municipio: </strong>" + mun + "<br><br>";
        var area = "<strong>Área: </strong>" + areaValue + " ha";
        popUp.innerHTML = title + munic + area;
        return popUp;
    }

    function createStopPopUp(stopData, routeName){
        var popUp = document.createElement("div");
        var route = "<h2>" + routeName + "</h2>";
        var title = "<h3>Parada: " + stopData.num + " - " + stopData.name + "</h3>";
        var desc = "<p>" + stopData.description + "</p>";
        var details = "";
        if(stopData.details != null && stopData.details != undefined && stopData.details != ""){
            details = "<strong>Detalles:</strong><p>" + stopData.details + "</p>";
        }
        popUp.innerHTML = route + title + desc + details;
        return popUp;
    }

    function createInfoSitePopUp(infoSite){
        var popUp = document.createElement("div");
        var title = "<h2>" + infoSite.name + "</h2>";
        var desc = "<p>" + infoSite.description + "<p>";
        var staff = "", phone = "", email = "", time = "", details = "";
        if(infoSite.staff != null && infoSite.staff != undefined && infoSite.staff != ""){
            staff = "<strong>Personal:</strong><p>" + infoSite.staff + "</p>";
        }
        if(infoSite.phone != null && infoSite.phone != undefined && infoSite.phone != ""){
            phone = "<strong>Teléfono:</strong><p>" + infoSite.phone + "</p>";
        }
        if(infoSite.email != null && infoSite.email != undefined && infoSite.email != ""){
            email = "<strong>Email:</strong><p>" + infoSite.email + "</p>";
        }
        if(infoSite.time != null && infoSite.time != undefined && infoSite.time != ""){
            time = "<strong>Horario:</strong><p>" + infoSite.time + "</p>";
        }
        if(infoSite.details != null && infoSite.details != undefined && infoSite.details != ""){
            details = "<strong>Detalles:</strong><p>" + infoSite.details + "</p>";
        }
        popUp.innerHTML = title + desc + staff + phone + email + time + details;
        return popUp;
    }

    function createRoutePopUp(routeData){
        var popUp = document.createElement("div");
        var title = "<h2>Ruta: " + routeData.name + "</h2>";
        var desc = "<p>" + routeData.description + "</p>";
        var dist = "", diff = "", dur = "", details = "", recom = "";
        if(routeData.dist != null && routeData.dist != undefined && routeData.dist != ""){
            dist = "<strong>Distancia:</strong><p>" + routeData.dist + " km</p>";
        }
        if(routeData.diff != null && routeData.diff != undefined && routeData.diff != ""){
            diff = "<strong>Dificultad:</strong><p>" + routeData.diff + "</p>";
        }
        if(routeData.dur != null && routeData.dur != undefined && routeData.dur != ""){
            dur = "<strong>Duración:</strong><p>" + routeData.dur + " minutos</p>";
        }
        if(routeData.details != null && routeData.details != undefined && routeData.details != ""){
            details = "<strong>Detalles:</strong><p>" + routeData.details + "</p>";
        }
        if(routeData.recom != null && routeData.recom != undefined && routeData.recom != ""){
            recom = "<strong>Recomendaciones:</strong><p>" + routeData.recom + "</p>";
        }
        popUp.innerHTML = title + desc + dist + diff + dur + details + recom;
        return popUp;
    }

    /***********************************************************************************************************************************************************************************************/

    /*********************************************FUNCION QUE CREA TODAS LAS PARADAS DE UNA RUTA Y LAS DEVUELVE EN FORMA DE ARRAY DE MARKERS DE LEAFLET*********************************************/

    function createStops(leafletMap, stops, routeColor, routeName){
        var stopsArray = new Array();
        var markerIcons = STOP_ICONS["default"];
        if(routeColor in STOP_ICONS_COLOR){
            markerIcons = STOP_ICONS[STOP_ICONS_COLOR[routeColor]];
        }
        for(var i = 0; i < stops.length; i++){
            var marker = L.marker(stops[i].pos, {icon: createStopIcon(i, markerIcons), alt: "Marker " + i + " - " + routeName}).addTo(leafletMap);
            marker.bindPopup(createStopPopUp(stops[i], routeName), {maxWidth: MAX_POPUP_WIDTH_LEAFLET});
            setMarkerHover(marker);
            stopsArray.push(marker);
        }
        return stopsArray;
    }

    /***********************************************************************************************************************************************************************************************/

    /******************************************FUNCION QUE CREA LOS LUGARES DE INFORMACION DEL PARQUE NATURAL Y LOS ALMACENA EN LA VARIABLE GLOBAL MAP**********************************************/

    function createInfoSites(leafletMap, infoSites){
        var infoSitesArray = new Array();
        for(var i = 0; i < infoSites.length; i++){
            var infoMarker = L.marker(infoSites[i].pos, {icon: createDefaultIcon(), alt: "Marker " + i + " - InfoSites"}).addTo(leafletMap);
            infoMarker.bindPopup(createInfoSitePopUp(infoSites[i]), {maxWidth: MAX_POPUP_WIDTH_LEAFLET});
            setMarkerHover(infoMarker);
            infoSitesArray.push(infoMarker);
        }
        map.infoSites = infoSitesArray;
    }

    /************************************************************************************************************************************************************************************************/

    /******************************************FUNCION QUE CREA UNA RUTA CON TODAS SUS PARADAS Y CARACTERISTICAS. DEVUELVE UN OBJETO DE TIPO ROUTE***************************************************/

    function createRoute(leafletMap, id, route){
        var polyline = L.polyline(route.points).addTo(leafletMap);
        var stopsArray = createStops(leafletMap, route.stops, route.color, route.name);
        polyline.bindPopup(createRoutePopUp(route), {maxWidth: MAX_POPUP_WIDTH_LEAFLET});
        setBorderHover(polyline);
        if(route.color != null && route.color != undefined && route.color != ""){
            polyline.setStyle({
                color: route.color
            });
        }
        return new Route(id, route.name, polyline, stopsArray);
    }

    /*************************************************************************************************************************************************************************************************/

    /***************************************************FUNCION QUE CREA TODAS LAS RUTAS DEL PARQUE NATURAL CONSEGUIDAS MEDIATE EL ARCHIVO JSON*******************************************************/

    function createRoutes(leafletMap, routes){
        var routesArray = new Array();
        for(var i = 0; i < routes.length; i++){
            routesArray.push(createRoute(leafletMap, "route" + i, routes[i]));
        }
        map.routes = routesArray;
    }

    /*************************************************************************************************************************************************************************************************/

    /****************************************************FUNCION CON LA QUE SE CREA EL AREA DEL PARQUE NATURAL Y SE ALMACENA EN LA VARIABLE GLOBAL MAP************************************************/

    function createNatParkArea(leafletMap, natPark, mun, area){
        var polyline = L.polyline(area.edge).addTo(leafletMap);
        polyline.bindPopup(createAreaPopUp(natPark, mun, area.value), {maxWidth: MAX_POPUP_WIDTH_LEAFLET});
        setBorderHover(polyline);
        map.area = polyline;
    }

    /**************************************************************************************************************************************************************************************************/

    /**************FUNCION CON LA QUE SE ESTABLECE EL PUNTO DE VISION QUE SE MOSTRARA EN EL MAPA. SE UTILIZA LA POSICION GEOGRAFICA DEL PARQUE NATURAL PARA SITUAR ESTE PUNTO DE VISION****************/

    function setMapView(leafletMap, view, zoom){
        leafletMap.setView(view, zoom);
    }

    /***************************************************************************************************************************************************************************************************/

    /*********************************************FUNCION CON LA QUE SE CAMBIA LA ETIQUETA INFERIOR DEL MAPA CORRESPONDIENTE AL COPYRIGHT DEL MISMO*****************************************************/

    function setTileLayer(leafletMap, license){
        var newTileLayer = map.tileLayer.options.attribution;
        if(license != null && license != undefined && license != ""){
            newTileLayer = newTileLayer + ", " + license;
        }
        map.tileLayer = L.tileLayer(map.tileLayer._url, {attribution: newTileLayer}).addTo(leafletMap);
    }

    /****************************************************************************************************************************************************************************************************/

    /*************************************FUNCION CON LA QUE SE CREA LA INFORMACION QUE SE MOSTRARA EN EL MAPA UNA VEZ SE HAN OBTENIDO LOS DATOS DEL ARCHIVO JSON****************************************/

    function createMapInfo(leafletMap){
        setTileLayer(leafletMap, mapData.license);
        setMapView(leafletMap, mapData.posGPS, LEAFLET_MAP_DEFAULT_ZOOM);
        createNatParkArea(leafletMap, mapData.natPark, mapData.mun, mapData.area);
        createRoutes(leafletMap, mapData.routes);
        createInfoSites(leafletMap, mapData.infoSites);
        console.log(map);
    }

    /*****************************************************************************************************************************************************************************************************/

    /***FUNCION CON LA QUE SE LEE EL ARCHIVO JSON DEL PARQUE NATURAL Y SE ALMACENA EN LA VARIABLE GLOBAL MAPDATA. UNA VEZ CARGADOS LOS DATOS LLAMA A LAS FUNCIONES ENCARGADAS DE CREAR EL MAPA Y LA UI****/

    function loadMapData(leafletMap){
        $.getJSON("https://raw.githubusercontent.com/FranciscoJavierGF/TFG/main/NPIM_Data/NPIM_Script_Data.json").done(function(data) {
            console.log(data);
            mapData = data;
            createMapInfo(leafletMap);
            createUserInterface();
        });
    }

    /********************************************************************************************************************************************************************************************************/

    /******************************************************FUNCION MEDIANTE LA CUAL SE INICIALIZA EL SCRIPT CREANDO EL MAPA Y CARGANDO SUS DATOS*************************************************************/

    function initScript(){
        createMap();
        loadMapData(map.leafletMap);
    }

    /*********************************************************************************************************************************************************************************************************/

    /************************************************FUNCION CON LA QUE SE CARGAN LOS ARCHIVOS CSS REQUERIDOS PARA EL CORRECTO FUNCIONAMIENTO DEL SCRIPT******************************************************/

    function loadCssRequirements(){
        const LEAFLET_LIB_CSS = GM_getResourceText("LEAFLET_LIBRARY_CSS");
        GM_addStyle(LEAFLET_LIB_CSS);
    }

    /**********************************************************************************************************************************************************************************************************/

    /********************************MAIN DEL SCRIPT. CUANDO SE CARGA LA VENTANA, CARGA LOS ARCHIVOS CSS NECESARIOS E INICIALIZA EL SCRIPT LLAMANDO A LAS FUNCIONES PERTINENTES********************************/

    window.addEventListener("load", function(){
        loadCssRequirements();
        initScript();
    });

    /***********************************************************************************************************************************************************************************************************/

})();