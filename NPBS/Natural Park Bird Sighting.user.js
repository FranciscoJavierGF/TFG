// ==UserScript==
// @name         Natural Park Bird Sighting
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Script con el que se crea una tabla de avistamiento de aves empleando para ello el api de eBird. Tambien se muestra un mapa con el que se puede observar, por cada ave, la posicion en la que se ha observado dentro del parque natural.
// @author       Francisco Javier García Fernández
// @icon         https://i.ibb.co/pnHY6NH/npbs-icon.png
// @match        https://parquesnaturales.gva.es/es/web/pn-lagunas-de-la-mata-torrevieja
// @match        https://parquesnaturales.gva.es/es/web/pn-lagunas-de-la-mata-torrevieja/lagunas-de-la-mata-torrevieja*
// @resource     LEAFLET_LIBRARY_CSS   https://unpkg.com/leaflet@1.7.1/dist/leaflet.css
// @resource     DATATABLE_JQUERY_CSS  https://cdn.datatables.net/v/dt/dt-1.10.24/r-2.2.7/datatables.min.css
// @require      https://unpkg.com/leaflet@1.7.1/dist/leaflet.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @require      https://cdn.datatables.net/v/dt/dt-1.10.24/r-2.2.7/datatables.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@10
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

/*

   ****************************************LICENSE*****************************************

      NPBS is licensed under a Creative Commons Attribution 4.0 International License.

   ****************************************************************************************

*/

(function() {
    'use strict';

    /********************************************************************CONSTANTES GLOBALES****************************************************************************/

    const DATES_EQUALS = 0;
    const DATES_LOWER = 1;
    const DATES_HIGHER = 2;

    const MAX_POPUP_WIDTH_LEAFLET = 300;
    const MAP_POS_GPS = [38.0122, -0.709444];
    const MAP_ZOOM = 12;

    /*******************************************************************************************************************************************************************/

    /*********************************************************************VARIABLES GLOBALES****************************************************************************/

    var provData = null; // Variable global en la que se almacenan los datos extraidos de eBird referentes a la provincia de Alicante

    /*******************************************************************************************************************************************************************/

    /******************************************************OBTENCION DEL CODIGO REFERENTE AL MUNICIPIO DE ALICANTE******************************************************/

    function obtainProvData(provsOfComAuto){
        var prov = null;
        for(var i = 0; i < provsOfComAuto.length; i++){
            if((provsOfComAuto[i].name).toLowerCase() == "alicante"){
                prov = provsOfComAuto[i];
                break;
            }
        }
        return prov;
    }

    function getAllProvsOfComAuto(comAutoCode){
        var request = comAutoCode + ".json";
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = false;

        xhr.addEventListener("readystatechange", function() {
            if(this.readyState === XMLHttpRequest.DONE) {
                if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                    var provs = JSON.parse(this.responseText);
                    provData = obtainProvData(provs);
                    console.log(provData);
                }
                else{
                    showServerErrorToUser();
                }
            }
        });

        xhr.open("GET", "https://api.ebird.org/v2/ref/region/list/subnational2/" + request);
        xhr.setRequestHeader("X-eBirdApiToken", "dm3m200i26fm");

        xhr.send();
    }

    function getComAutoCode(allComAuto){
        var comAutoCode = null;
        for(var i = 0; i < allComAuto.length; i++){
            if((allComAuto[i].name).toLowerCase().search("valencia") != -1){
                comAutoCode = allComAuto[i].code;
                break;
            }
        }
        return comAutoCode;
    }

    function getProvData(){
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = false;

        xhr.addEventListener("readystatechange", function() {
            if(this.readyState === XMLHttpRequest.DONE) {
                if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                    var comAutos = JSON.parse(this.responseText);
                    var comAutoCode = getComAutoCode(comAutos);
                    getAllProvsOfComAuto(comAutoCode);
                }
                else{
                    showServerErrorToUser();
                }
            }
        });

        xhr.open("GET", "https://api.ebird.org/v2/ref/region/list/subnational1/ES.json");
        xhr.setRequestHeader("X-eBirdApiToken", "dm3m200i26fm");

        xhr.send();
    }

    /*********************************************************************************************************************************************************************/

    /********************FUNCION EN LA QUE SE OBTIENE LA FECHA ESPECIFICADA POR EL USUARIO EN EL FORMATO ADECUADO PARA REALIZAR LA PETICION A EBIRD***********************/

    function getDateRequest(date){
        var dateSplit = date.split("-");
        return [dateSplit[0] + "/" + dateSplit[1] + "/" + dateSplit[2]];
    }

    /*********************************************************************************************************************************************************************/

    /******************FUNCION EN LA QUE SE CREA EL ICONO EMPLEADO EN EL MAPA DE LEAFLET PARA IDENTIFICAR LA POSICION EN LA QUE SE HA VISUALIZADO EL AVE******************/

    function createBirdIcon(){
        var birdIcon = null;
        birdIcon = L.icon({
            iconUrl: "https://i.ibb.co/gdVH9k8/birdIcon.png",
            iconSize:     [50, 50],
            iconAnchor:   [25, 50],
            popupAnchor:  [-3, -50]
        });
        return birdIcon;
    }

    /**********************************************************************************************************************************************************************/

    /*************************************FUNCION EN LA QUE SE REALIZA EL EVENTO ONHOVER PARA EL ICONO MOSTRADO EN EL MAPA DE LEAFLET**************************************/

    function setMarkerHover(marker){
        marker.on("mouseover", function(e){
            this.openPopup();
        });
        marker.on("mouseout", function(e){
            this.closePopup();
        });
        marker.off("click");
    }

    /**********************************************************************************************************************************************************************/

    /**********************************CREACION DEL MAPA DE LEAFLET CONFIGURADO PARA LA CORRECTA VISUALIZACION DEL PARQUE NATURAL******************************************/

    function setBirdSightTableStyle(birdSightTable){
        birdSightTable.classList.add("display", "responsive", "nowrap");
        birdSightTable.style.width = "100%";
    }

    function setMapView(leafletMap, view, zoom){
        leafletMap.setView(view, zoom);
    }

    function createBirdSightTable(){
        var parent = document.getElementById("article_10155_80302856_170097689_1.1");
        var birdSightTable = document.createElement("table");
        birdSightTable.setAttribute("id", "birdSightTable");
        setBirdSightTableStyle(birdSightTable);
        parent.appendChild(birdSightTable);
    }

    function createMap(){
        var leafletMap = L.map('map');
        var tileLayerMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://www.birds.cornell.edu/home">Cornell Lab of Ornithology</a>'
        }).addTo(leafletMap);
        setMapView(leafletMap, MAP_POS_GPS, MAP_ZOOM);
        return leafletMap;
    }

    /*************************************************************************************************************************************************************************/

    /**********************************CREACION DEL MARCADOR QUE IDENTIFICARA LA POSICION DEL AVE SELECCIONADA POR EL USUARIO EN EL MAPA**************************************/

    function createBirdMarkerPopUp(birdData){
        var popUp = document.createElement("div");
        var title = "<h2>" + birdData.comName + "</h2>";
        var sciName = "<p><strong>Nombre Científico: </strong>" + birdData.sciName + "</p>";
        var num = "", date = "";
        if(birdData.howMany != null && birdData.howMany != undefined && birdData.howMany != ""){
            num = "<p><strong>Número de avistamientos: </strong>" + birdData.howMany + "</p>";
        }
        if(birdData.obsDt != null && birdData.obsDt != undefined && birdData.obsDt != ""){
            date = "<p><strong>Fecha y hora de observación: </strong>" + birdData.obsDt + "</p>";
        }
        popUp.innerHTML = title + sciName + num + date;
        return popUp;
    }

    function createBirdMarker(leafletMap, birdData){
        var birdPos = JSON.parse("[" + birdData.lat + ", " + birdData.lng + "]");
        console.log(birdPos);
        var marker = L.marker(birdPos, {icon: createBirdIcon(), alt: "Bird position marker" }).addTo(leafletMap);
        marker.bindPopup(createBirdMarkerPopUp(birdData), {maxWidth: MAX_POPUP_WIDTH_LEAFLET});
        setMarkerHover(marker);
    }

    /****************************************************************************************************************************************************************************/

    /*****FUNCION EN LA QUE SE CARGA EL MAPA DE LEAFLET JUNTO CON SU MARCADOR CUANDO EL USUARIO CLICA SOBRE EL BOTON DENOMINADO MAPA PRESENTE EN TODAS LAS FILAS DE LA TABLA*****/

    function loadMap(birdData){
        var leafletMap = createMap();
        createBirdMarker(leafletMap, birdData);
    }

    /****************************************************************************************************************************************************************************/

    /*******************************FUNCIONES CON LAS QUE SE ELIMINA LA TABLA DE VISUALIZACION DE AVES EN CASO DE HABERSE CREADO ANTERIORMENTE***********************************/

    function destroyTable(birdSightTableDom){
        $("#birdSightTable").DataTable().destroy();
        var parent = birdSightTableDom.parentNode;
        parent.removeChild(birdSightTableDom);
    }

    function cleanTable(){
        var birdSightTableDom = document.getElementById("birdSightTable");
        if(birdSightTableDom != undefined && birdSightTableDom != null){
            destroyTable(birdSightTableDom);
        }
    }

    /*****************************************************************************************************************************************************************************/

    /******FUNCION EN LA QUE SE CORRIGE EL FORMATO DE LA FECHA DE MANERA QUE PRESENTE EL FORMATO DD-MM-YYYY CON TAL DE MOSTRAR ESTA FECHA DE LA MANERA ESPERADA EN LOS POPUPS*****/

    function putDateInCorrectFormat(date){
        var newDate = date.split("-");
        newDate = newDate[2] + "-" + newDate[1] + "-" + newDate[0];
        return newDate;
    }

    /*****************************************************************************************************************************************************************************/

    /********************FUNCION EN LA QUE SE COMPARAN 2 OBJETOS DE TIPO DATE DE MANERA EN QUE SE PUEDA DETERMINAR SI LAS FECHAS SON IGUALES, PASADAS O FUTURAS*******************/

    function compareDatesWH(date1, date2){
        var comp = DATES_EQUALS; // Son iguales
        if(date1.getFullYear() < date2.getFullYear()){
            comp = DATES_LOWER; // Date 1 es menor que date 2
        }
        else if(date1.getFullYear() > date2.getFullYear()){
            comp = DATES_HIGHER; // Date 1 es mayor que Date 2
        }
        else{
            if(date1.getFullYear() == date2.getFullYear() && date1.getMonth() < date2.getMonth()){
                comp = DATES_LOWER;
            }
            else if(date1.getFullYear() == date2.getFullYear() && date1.getMonth() > date2.getMonth()){
                comp = DATES_HIGHER; // Date 1 es mayor que Date 2
            }
            else{
                if(date1.getFullYear() == date2.getFullYear() && date1.getMonth() == date2.getMonth() && date1.getDate() < date2.getDate()){
                    comp = DATES_LOWER;
                }
                else{
                    if(date1.getFullYear() == date2.getFullYear() && date1.getMonth() == date2.getMonth() && date1.getDate() > date2.getDate()){
                        comp = DATES_HIGHER; // Date 1 es mayor que Date 2
                    }
                }
            }
        }
        return comp;
    }

    /*****************************************************************************************************************************************************************************/

    /************************FUNCION CON LA QUE SE CREA EL POPUP CORRESPONDIENTE AL MAPA DE LEAFLET EN EL QUE SE VISUALIZA LA POSICION DEL AVE AVISTADA***************************/

    function showMapPopUpToUser(birdData){
        console.log(birdData);
        Swal.fire({
            title: '<strong>' + birdData.comName + '</strong>',
            icon: 'info',
            html:
            '<div id="map" style="width: 35em; height: 40em"></div>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        }).then(loadMap(birdData)).catch( (dismiss) => {});
    }

    /*******************************************************************************************************************************************************************************/

    /********************************************MENSAJE MODAL DE ERROR DE SERVIDOR (PRODUCIDO AL HACER LLAMADAS A LA API DE EBIRD)*************************************************/

    function showServerErrorToUser(){
        Swal.fire({
            title: '<strong>Error en el servidor</strong>',
            icon: 'error',
            html:
            '<p>Se ha producido un error en el servidor de eBird mientras se estaban recopilando los datos. Por favor, recargue la página para volver a intentarlo.</p>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /*******************************************************************************************************************************************************************************/

    /*******FUNCION EN LA QUE SE MUESTRA EL POPUP CORRESPONDIENTE AL ERROR PRODUCIDO POR NO POSEER DATOS DE LATITUD O LONGITUD, NECESARIOS PARA PODER SITUAR AL AVE EN EL MAPA******/

    function showInsufDataErrorToUser(){
        Swal.fire({
            title: '<strong>Información insuficiente</strong>',
            icon: 'info',
            html:
            '<p>No se dispone de los datos de latitud o longitud necesarios para poder situar el ave en el mapa.</p>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /*********************************************************************************************************************************************************************************/

    /**********************FUNCION EN LA QUE SE MUESTRA EL POPUP CORRESPONDIENTE A LA NO CARGA DE LOS DATOS NECESARIOS PARA EL CORRECTO FUNCIONAMIENTO DEL SCRIPT*********************/

    function showNoDataLoadedToUser(){
        Swal.fire({
            title: '<strong>Cargando datos</strong>',
            icon: 'info',
            html:
            '<p>Se estan cargando los datos, por favor, inténtelo de nuevo en un par de segundos.</p>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /*******************************************************************************************************************************************************************************/

    /***************************FUNCION EN LA QUE SE MUESTRA EL POPUP CORRESPONDIENTE AL NO AVISTAMIENTO DE NINGUNA CLASE DE AVE EN EL PARQUE NATURAL*********************************/

    function showNoDataToUser(date){
        cleanTable();
        Swal.fire({
            title: '<strong>' + date + '</strong>',
            icon: 'info',
            html:
            '<p>No se ha avistado ningún tipo de ave.</p>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /***********************************************************************************************************************************************************************************/

    /*******FUNCION EN LA QUE SE MUESTRA EL POPUP CORRESPONDIENTE A LA NO ESPECIFICACION DE LA FECHA POR LA QUE SE QUIERE COMPROBAR EL AVISTAMIENTO DE AVES EN EL PARQUE NATURAL********/

    function showNoDateSpecifiedToUser(){
        cleanTable();
        Swal.fire({
            title: '<strong>Fecha no especificada</strong>',
            icon: 'info',
            html:
            '<p>No has indicado la fecha por la que quieres comprobar el avistamiento de aves.</p>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /***********************************************************************************************************************************************************************************/

    /****************FUNCION EN LA QUE SE MUESTRA EL POPUP CORRESPONDIENTE A LA SELECCION ERRONEA DE UNA FECHA FUTURA PARA EL AVISTAMIENTO DE AVES POR PARTE DEL USUARIO****************/

    function showIncorrectDateErrorToUser(date){
        cleanTable();
        Swal.fire({
            title: '<strong>' + date + '</strong>',
            icon: 'info',
            html:
            '<p>No se puede determinar el avistamiento de aves en una fecha futura.</p>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /************************************************************************************************************************************************************************************/

    /********************************************FUNCION UTILIZADA PARA CREAR EL DATATABLE CORRESPONDIENTE A LOS DATOS EXTRAIDOS MEDIANTE EBIRD******************************************/

    function completeTable(birdSightData){
        var birdSightTable = $("#birdSightTable").DataTable( {
            responsive: true,
            "data": birdSightData,
            "columnDefs": [ {
                "targets": -1,
                "data": null,
                "defaultContent": "<button>Mapa</button>"
            } ],
            "columns": [
                {title: "Nom Común", name: "Nom Común", data: "comName", defaultContent: 'Sin Datos'},
                {title: "Nom Cient", name: "Nom Cient", data: "sciName", defaultContent: 'Sin Datos'},
                {title: "Núm Vistos", name: "Núm Vistos", data: "howMany", defaultContent: 'Sin Datos'},
                {title: "Nom Loc", name: "Nom Lo", data: "locName", defaultContent: 'Sin Datos'},
                {title: "Latitud", name: "Latitud", data: "lat", defaultContent: 'Sin Datos'},
                {title: "Longitud", name: "Longitud", data: "lng", defaultContent: 'Sin Datos'},
                {title: "Fecha", name: "Fecha", data: "obsDt", defaultContent: 'Sin Datos'},
                {title: "Visualización", name: "Visualización"}
            ]
        } );
        $('#birdSightTable tbody').on("click", "button", function(){
            var parentRow = $(this).parents("tr").prev()[0];
            var rowData = birdSightTable.row(parentRow).data();
            if(rowData.lat != null && rowData.lat != undefined && rowData.lat != "" && rowData.lng != null && rowData.lng != undefined && rowData.lng != ""){
                showMapPopUpToUser(rowData);
            }
            else{
                showInsufDataErrorToUser();
            }
        });
    }

    /****************************************************************************************************************************************************************************************/

    /************FUNCION MEDIANTE LA CUAL SE REALIZA LA CREACION DE LA TABLA EN LA QUE SE MOSTRARAN LOS DATOS PROPORCIONADOS POR EBIRD SEGUN LA OPCION SELECCIONADA POR EL USUARIO***********/

    function showBirdSightDataToUser(birdSightData){
        cleanTable();
        createBirdSightTable();
        completeTable(birdSightData);
    }

    /*****************************************************************************************************************************************************************************************/

    /**FUNCION MEDIANTE LA CUAL SE REALIZA EL FILTRADO POR NOMBRE DE LOS DATOS EXTRAIDOS DE EBIRD REFERENTES A LA PROVINCIA DE ALICANTE PARA CONSEGUIR SOLO LOS REFERENTES AL PARQUE NATURAL**/

    function getNatParkBirdSightData(birdSightData){
        var natParkBirdSight = new Array();
        if(birdSightData != null && birdSightData != undefined && birdSightData != "" && birdSightData.length > 0){
            for(var i = 0; i < birdSightData.length; i++){
                if(birdSightData[i].locName != null && birdSightData[i].locName != undefined && birdSightData[i].locName != ""){
                    if((birdSightData[i].locName).toLowerCase().search("pnat") != -1){
                        if((birdSightData[i].locName).toLowerCase().search("la mata") != -1){
                            natParkBirdSight.push(birdSightData[i]);
                        }
                    }
                }
            }
        }
        console.log(natParkBirdSight);
        return natParkBirdSight;
    }

    /********************************************************************************************************************************************************************************************/

    /*********************PETICION AL API DE EBIRD EN EL QUE SE OBTIENEN LOS DATOS DE LOS AVISTAMIENTOS DE AVES EN EL PARQUE NATURAL PARA LA FECHA SELECCIONADA POR EL USUARIO*******************/

    function getBirdSightData(date){
        console.log(date);
        if(provData != null){
            if(date != null && date != undefined && date != ""){
                var dateObj = new Date(date);
                var now = new Date();
                var correctDate = putDateInCorrectFormat(date);
                if(compareDatesWH(dateObj, now) != DATES_HIGHER){
                    var xhr = new XMLHttpRequest();
                    xhr.withCredentials = false;

                    xhr.addEventListener("readystatechange", function() {
                        if(this.readyState === XMLHttpRequest.DONE) {
                            if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                                var data = JSON.parse(this.responseText);
                                console.log(data);
                                var birdSightData = getNatParkBirdSightData(data);
                                if(birdSightData.length > 0){
                                    showBirdSightDataToUser(birdSightData);
                                }
                                else{
                                    showNoDataToUser(correctDate);
                                }
                            }
                            else{
                                showServerErrorToUser();
                            }
                        }
                    });

                    xhr.open("GET", "https://api.ebird.org/v2/data/obs/" + provData.code + "/historic/" + getDateRequest(date) + "?sppLocale=es");
                    xhr.setRequestHeader("X-eBirdApiToken", "dm3m200i26fm");

                    xhr.send();
                }
                else{
                    showIncorrectDateErrorToUser(correctDate);
                }
            }
            else{
                showNoDateSpecifiedToUser();
            }
        }
        else{
            showNoDataLoadedToUser();
        }
    }

    /**************************************************************************************************************************************************************************************************/

    /**********************************PETICION AL API DE EBIRD EN EL QUE OBTIENEN LOS AVISTAMIENTOS DE AVES EN EL PARQUE NATURAL PARA LOS ULTIMOS 30 DIAS PASADOS*************************************/

    function getBirdSightDataLast30Days(){
        if(provData != null){
            var xhr = new XMLHttpRequest();
            xhr.withCredentials = false;

            xhr.addEventListener("readystatechange", function() {
                if(this.readyState === XMLHttpRequest.DONE) {
                    if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                        var data = JSON.parse(this.responseText);
                        console.log(data);
                        var birdSightData = getNatParkBirdSightData(data);
                        if(birdSightData.length > 0){
                            showBirdSightDataToUser(birdSightData);
                        }
                        else{
                            showNoDataToUser("Últimos 30 días");
                        }
                    }
                    else{
                        showServerErrorToUser();
                    }
                }
            });

            xhr.open("GET", "https://api.ebird.org/v2/data/obs/" + provData.code + "/recent/notable?back=30&sppLocale=es");
            xhr.setRequestHeader("X-eBirdApiToken", "dm3m200i26fm");
            xhr.send();
        }
        else{
            showNoDataLoadedToUser();
        }
    }

    /****************************************************************************************************************************************************************************************************/

    /****************************************************FUNCIONES EN LAS QUE SE MUESTRA LA CREACION DEL ESTILO CSS QUE PRESENTARA LA INTERFAZ DE USUARIO************************************************/

    function setCalendarInputStyle(calInput){
        calInput.style.alignSelf = "center";
        calInput.style.width = "60%";
    }

    function setButtonStyle(button){
        button.style.alignSelf = "center";
        button.style.width = "40%";
        button.style.marginBottom = "1em";
    }

    function setFormTitleStyle(formTitle){
        formTitle.style.fontSize = "1.5em";
        formTitle.style.margin = "0.5em";
        formTitle.style.textAlign = "center";
        formTitle.style.color = "#000000";
    }

    function setFormStyle(form){
        form.style.display = "flex";
        form.style.flexDirection = "column";
        form.style.justifyContent = "center";
    }

    /****************************************************************************************************************************************************************************************************/

    /******************************************************************************CREACION DE LA INTERFAZ DE USUARIO************************************************************************************/

    function createCalendarInput(){
        var calInput = document.createElement("input");
        calInput.setAttribute("type", "date");
        setCalendarInputStyle(calInput);
        return calInput;
    }

    function createButton(name){
        var button = document.createElement("button");
        button.innerHTML = name;
        setButtonStyle(button);
        return button;
    }

    function createLast30DaysButton(name){
        var button = createButton(name);
        button.addEventListener("click", function(){event.preventDefault(); getBirdSightDataLast30Days()}, false);
        return button;
    }

    function createFormTitle(){
        var formTitle = document.createElement("h3");
        formTitle.innerHTML = "Avistamiento de Aves";
        setFormTitleStyle(formTitle);
        return formTitle;
    }

    function createForm(){
        var form = document.createElement("form");
        form.setAttribute("id", "birdSight");
        form.addEventListener("submit", function(){event.preventDefault(); getBirdSightData(this.firstChild.nextSibling.value)}, false);
        form.appendChild(createFormTitle());
        form.appendChild(createCalendarInput());
        form.appendChild(createButton("Comprobar"));
        form.appendChild(createLast30DaysButton("Últimos 30 días"));
        setFormStyle(form);
        return form;
    }

    function createUserInterface(){
        var form = createForm();
        var parent = document.querySelectorAll("body .mini-calendar-mes ")[0];
        parent.appendChild(form);
    }

    /****************************************************************************************************************************************************************************************************/

    /************************************FUNCION CON LA QUE SE INICIALIZA EL SCRIPT CARGANDO LOS DATOS DE LA PROVINCIA DE ALICANTE Y CREANDO LA INTERFAZ DE USUARIO**************************************/

    function initScript(){
        getProvData();
        createUserInterface();
    }

    /****************************************************************************************************************************************************************************************************/

    /************************************************FUNCION CON LA QUE SE CARGAN LOS FICHEROS CSS NECESARIOS PARA EL CORRECTO FUNCIONAMIENTO DEL SCRIPT*************************************************/

    function loadCssRequirements(){
        const LEAFLET_LIB_CSS = GM_getResourceText("LEAFLET_LIBRARY_CSS");
        GM_addStyle(LEAFLET_LIB_CSS);
        const DATATABLE_JQ_CSS = GM_getResourceText("DATATABLE_JQUERY_CSS");
        GM_addStyle(DATATABLE_JQ_CSS);
    }

    /*****************************************************************************************************************************************************************************************************/

    /**************MAIN DEL SCRIPT. CUANDO SE CARGA LA PAGINA WEB AL COMPLETO SE CARGAN LOS RECURSOS CSS NECESARIOS JUNTO CON LOS DATOS EMPLEADOS PARA EL CORRECTO FUNCIONAMIENTO DEL SCRIPT**************/

    window.addEventListener("load", function(){
        loadCssRequirements();
        initScript();
    });

    /*****************************************************************************************************************************************************************************************************/

})();