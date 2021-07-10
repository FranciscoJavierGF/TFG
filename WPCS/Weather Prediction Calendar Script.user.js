// ==UserScript==
// @name         Weather Prediction Calendar Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Script que recopila los datos de Aemet y muestra en el calendario situado en la página de index de lagunas de la mata en torrevieja (versión en español) una predicción del tiempo que hará o que ha hecho en el día que has clicado en el calendario de dicha página.
// @author       Francisco Javier García Fernández
// @icon         https://i.ibb.co/dtv3qf1/time-prediction-calendar-script-icon.png
// @match        https://parquesnaturales.gva.es/es/web/pn-lagunas-de-la-mata-torrevieja
// @match        https://parquesnaturales.gva.es/es/web/pn-lagunas-de-la-mata-torrevieja/lagunas-de-la-mata-torrevieja*
// @require      https://cdn.jsdelivr.net/npm/geodesy@2/dms.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@10
// @require      https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.4/Chart.js
// @grant        none
// ==/UserScript==

/*

   ****************************************LICENSE*****************************************

      WPCS is licensed under a Creative Commons Attribution 4.0 International License.

   ****************************************************************************************

*/

(function() {
    'use strict';

    /********************************************************************************CONSTANTES GLOBALES***********************************************************************************************/

    const DATES_EQUALS = 0;
    const DATES_LOWER = 1;
    const DATES_HIGHER = 2;

    const PREDICTION_TYPE = 1;
    const TIME_PAST_TYPE = 2;

    const GRAPH_TABLE_TYPE = 1;
    const TABLE_TYPE = 2;

    const MONTHS_OF_YEAR = {enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11}; // Meses del anyo almacenados segun la numeracion mensual del sistema
    const SUN_HOURS_OF_TORR_PER_MONTH = new Array(10.15, 11.21, 12.37, 13.45, 14.38, 14.50, 14.45, 14.05, 12.59, 11.47, 10.35, 9.53); // Media de horas de sol por mes en torrevieja

    /**************************************************************************************************************************************************************************************************/

    /*******************************************************************CLAVE DE AEMET UTILIZADA PARA REALIZAR LAS PETICIONES**************************************************************************/

    const aemetKey = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmamdmMTFAZ2Nsb3VkLnVhLmVzIiwianRpIjoiZTdhMzMyYmItMDhkNC00OGQ3LWEwM2MtNDAxZmU0M2EzODZkIiwiaXNzIjoiQUVNRVQiLCJpYXQiOjE2MDU2NTQ0OTcsInVzZXJJZCI6ImU3YTMzMmJiLTA4ZDQtNDhkNy1hMDNjLTQwMWZlNDNhMzg2ZCIsInJvbGUiOiIifQ.cnfSmxT-fyR8ncl9sbhxx0v-pL-REi1xZLDTn6oSA3s";

    /**************************************************************************************************************************************************************************************************/

    /******************************************************************CLASES CREADAS Y UTILIZADAS*****************************************************************************************************/

    class Position{
        constructor(latitud, longitud){
            this.latitud = latitud;
            this.longitud = longitud;
        }
        degreeToRadians(degree){
            return (degree*(Math.PI))/180.0;
        }
        distanceTo(position, radious = 6371e3){ // Metodo basado en el metodo distanceTo de la libreria con licencia MIT llamada latlon-spherical.js con enlace --> https://cdn.jsdelivr.net/npm/geodesy@2/latlon-spherical.js
            // Formula de Haversine:
            // a = sin²(Δφ/2) + cos(φ1)⋅cos(φ2)⋅sin²(Δλ/2)
            // δ = 2·atan2(√(a), √(1−a))

            const R = radious;
            const Fi1 = this.degreeToRadians(this.latitud);
            const Lambda1 = this.degreeToRadians(this.longitud);
            const Fi2 = this.degreeToRadians(position.latitud);
            const Lambda2 = this.degreeToRadians(position.longitud);
            const DeltaFi = Fi2 - Fi1;
            const DeltaLambda = Lambda2 - Lambda1;

            var a = Math.sin(DeltaFi/2)*Math.sin(DeltaFi/2) + Math.cos(Fi1)*Math.cos(Fi2) * Math.sin(DeltaLambda/2)*Math.sin(DeltaLambda/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            var distance = R * c;

            return distance;
        }
    }

    // Datos del municipio de Torrevieja obtenidos mediante Aemet
    class Municipio{
        constructor(id, data){
            this.id = id;
            this.data = data;
            this.estMasCercana = null;
            this.distanceToEstMasCercana = null;
        }
    }

    /*******************************************************************************************************************************************************************************************************/

    /**************************************************************************************VARIABLES GLOBALES***********************************************************************************************/

    var torrevieja = null; // Municipio sobre los que se basan los datos

    var sunHoursOfTorr = null; // Numero de horas de sol que ha hecho en torrevieja en el mes que se le indica

    /********************************************************************************************************************************************************************************************************/

    /***************************************************************OBTENEMOS LOS DATOS DE TORREVIEJA Y DE SU ESTACION MAS CERCANA***************************************************************************/

    function findMunTorreviejaData(municipios){
        var munData = null;
        for(var key in municipios){
            var actMun = (municipios[key].nombre).toLowerCase();
            if(actMun == "torrevieja"){
                munData = municipios[key];
                break;
            }
        }
        console.log(munData);
        return munData;
    }

    function getMunTorreviejaData(){
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.addEventListener("readystatechange", function () {
            if (this.readyState === XMLHttpRequest.DONE) {
                if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                    var data = JSON.parse(this.responseText);
                    var torrData = findMunTorreviejaData(data);
                    var torrDataID = (torrData.id).slice(2);
                    torrevieja = new Municipio(torrDataID, torrData);
                    console.log(torrDataID);
                    getEstacionMasCercanaData();
                }
                else{
                    showServerErrorToUser();
                }
            }
        });

        xhr.open("GET", "https://opendata.aemet.es/opendata/api/maestro/municipios?api_key=" + aemetKey);
        xhr.setRequestHeader("cache-control", "no-cache");
        xhr.send();
    }

    function coordenadasGPS(coordlat, coordlon) {

        var lt = Array.from(coordlat);
        var ln = Array.from(coordlon);
        var gradlat = parseInt(lt[0] + lt[1]);
        var minlat = parseInt(lt[2] + lt[3]);
        var seglat = parseFloat(lt[4] + lt[5]);
        var hemisflat = lt[6];
        var gradlon = parseInt(ln[0] + ln[1]);
        var minlon = parseInt(ln[2] + ln[3]);
        var seglon = parseFloat(ln[4] + ln[5]);
        var hemisflon = ln[6];

        var latdms = gradlat + " " + minlat + " " + seglat + hemisflat;
        var londms = gradlon + " " + minlon + " " + seglon + hemisflon;

        var latdef = Dms.parse(latdms);
        var londef = Dms.parse(londms);

        return [latdef, londef];

    }

    function getMunEstDistance(munPosition, estData){
        var [lat, long] = coordenadasGPS(estData.latitud, estData.longitud);
        var estPosition = new Position(lat, long);
        return munPosition.distanceTo(estPosition);
    }

    function findEstacionMasCercana(estaciones){
        var munPosition = new Position(torrevieja.data.latitud_dec, torrevieja.data.longitud_dec);
        var distance = getMunEstDistance(munPosition, estaciones[0]);
        for(var key = 1; key < estaciones.length; key++){
            var distAux = getMunEstDistance(munPosition, estaciones[key]);
            if(distAux < distance){
                distance = distAux;
                torrevieja.estMasCercana = estaciones[key];
                torrevieja.distancetoEstMasCercana = distance;
            }
        }
        console.log("DISTANCE: " + torrevieja.distancetoEstMasCercana);
        console.log("DISTANCE - KM: " + torrevieja.distancetoEstMasCercana/1000);
        console.log("ESTACION: " + torrevieja.estMasCercana.nombre);
    }

    function getEstacionMasCercanaUrl(urlData){
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.addEventListener("readystatechange", function () {
            if (this.readyState === XMLHttpRequest.DONE) {
                if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                    var data = JSON.parse(this.responseText);
                    console.log(data);
                    findEstacionMasCercana(data);
                }
                else{
                    showServerErrorToUser();
                }
            }
        });

        xhr.open("GET", urlData);
        xhr.setRequestHeader("cache-control", "no-cache");
        xhr.send();
    }

    function getEstacionMasCercanaData(){
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.addEventListener("readystatechange", function () {
            if (this.readyState === XMLHttpRequest.DONE) {
                if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                    console.log(this.responseText);
                    var url = JSON.parse(this.responseText).datos;
                    getEstacionMasCercanaUrl(url);
                }
                else{
                    showServerErrorToUser();
                }
            }
        });

        xhr.open("GET", "https://opendata.aemet.es/opendata/api/valores/climatologicos/inventarioestaciones/todasestaciones?api_key=" + aemetKey);
        xhr.setRequestHeader("cache-control", "no-cache");
        xhr.send();
    }


    /****************************************************************************************************************************************************************************/

    /********************************OBTENEMOS EL ANYO, EL MES Y LOS DIAS QUE PERTENECEN A DICHO MES MOSTRADOS EN EL CALENDARIO DEL SITIO WEB************************************/

    function processDaysInCalendar(days){
        var newDays = new Array();
        for(var i = 0; i < days.length; i++){
            if(!days[i].classList.contains("calendar-inactive")){
                newDays.push(days[i]);
            }
        }
        return newDays;
    }

    function getMonthNumber(month){
        var monthNumber = 0;
        month = month.toLowerCase();
        for(var m in MONTHS_OF_YEAR){
            if(m == month){
                monthNumber = MONTHS_OF_YEAR[m];
                sunHoursOfTorr = SUN_HOURS_OF_TORR_PER_MONTH[monthNumber]; // Actualizamos las horas de sol del municipio de torrevieja en funcion del mes mostrado en el calendario del sitio web
            }
        }
        return monthNumber;
    }

    function getMonthYear(){
        var monthYear = document.querySelectorAll("body .mini-calendar-mes .mini-calendar-header .mini-calendar-month")[0].innerHTML;
        monthYear = monthYear.split(" ");
        monthYear[0] = getMonthNumber(monthYear[0]);
        return [monthYear[0], monthYear[1]];
    }


    /************************************************************************************************************************************************************/

    /*****************INSERTAMOS LAS IMAGENES EN EL CALENDARIO COMPARANDO LA FECHA ACTUAL CON LA DE CADA DIA PARA ASI ASIGNAR UN EVENTO U OTRO*******************/

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

    function createImageForCalendar(type, month, year){
        var imgCalendar = document.createElement("img");
        imgCalendar.src = 'https://i.ibb.co/ZYJM23T/pred-Tiempo.png';
        imgCalendar.alt = 'Imagen prediccion de tiempo';
        imgCalendar.border = '0';
        imgCalendar.onmouseover=function(e){
            this.style="max-width: 100%; cursor: pointer; filter: sepia(125%)";
        }
        imgCalendar.onmouseleave=function(e){
            this.style="max-width: 100%; cursor: auto; filter: sepia(0%)";
        }
        if(type==PREDICTION_TYPE){
            imgCalendar.addEventListener("click", function(){getDayPrediction(this.parentNode.children[0].children[0].innerHTML, month, year)}, false);
        }
        else{
            imgCalendar.addEventListener("click", function(){getDayTimePast(this.parentNode.children[0].children[0].innerHTML, month, year)}, false);
        }
        return imgCalendar;
    }

    function insertImagesInCalendar(){
        var days = document.querySelectorAll("body .mini-calendar-mes div div table tbody tr td");
        var now = new Date();
        var [month, year] = getMonthYear();
        days = processDaysInCalendar(days); // Obtenemos los dias que pertenecen al mes, excluyendo para ello a aquellos que pertenezcan o a un mes anterior o a un mes siguiente
        for(var i = 0; i < days.length; i++){
            var dmy = new Date(year, month, days[i].children[0].children[0].innerHTML);
            if(compareDatesWH(dmy, now) == DATES_EQUALS || compareDatesWH(dmy, now) == DATES_HIGHER){
                days[i].appendChild(createImageForCalendar(PREDICTION_TYPE, month, year));
            }
            else{
                days[i].appendChild(createImageForCalendar(TIME_PAST_TYPE, month, year));
            }
        }
    }


    /********************************************************************************************************************************************************************/

    /**********************************FUNCION PARA INTRODUCIR DATOS A UN ARRAY SUSTITUYENDO POR UN: NO HAY DATOS, CUANDO CORRESPONDA************************************/

    function pushDataToArray(dataArray, newData){
        if(newData != null && newData != undefined && newData.toString() != ""){
            dataArray.push(newData.toString());
        }else{
            dataArray.push("Sin datos");
        }
    }

    /*********************************************************************************************************************************************************************/

    /*************************************OBTENEMOS LOS DATOS QUE SE MOSTRARAN EN EL GRAFICO DE PREDICCION DEL TIEMPO*****************************************************/

    function getTempArrayDataForGraph(temp){
        var tempArrayData = new Array();
        for(var i = 0; i < temp.dato.length; i++){
            pushDataToArray(tempArrayData, temp.dato[i].value);
        }
        return tempArrayData;
    }

    function getHumRelArrayDataForGraph(humRel){
        var humRelArrayData = new Array();
        for(var i = 0; i < humRel.dato.length; i++){
            pushDataToArray(humRelArrayData, humRel.dato[i].value);
        }
        return humRelArrayData;
    }

    function getProbPrecArrayDataForGraph(probPrec){
        var graphLabels = new Array();
        var graphProbPrecArrayData = new Array();
        for(var i = 0; i < probPrec.length; i++){
            if(probPrec[i].periodo == "00-24" || probPrec[i].periodo == "00-12" || probPrec[i].periodo == "12-24"){
                continue;
            }
            graphLabels.push(probPrec[i].periodo + "h");
            pushDataToArray(graphProbPrecArrayData, probPrec[i].value);
        }
        return [graphLabels, graphProbPrecArrayData];
    }

    function getVientoArrayDataForGraph(viento){
        var graphVientoArrayDir = new Array();
        var graphVientoArrayData = new Array();
        for(var i = 0; i < viento.length; i++){
            if(viento[i].periodo == "00-24" || viento[i].periodo == "00-12" || viento[i].periodo == "12-24"){
                continue;
            }
            graphVientoArrayDir.push(viento[i].direccion);
            pushDataToArray(graphVientoArrayData, viento[i].velocidad);
        }
        return [graphVientoArrayDir, graphVientoArrayData];
    }

    /*********************************************************************************************************************************************************************************/

    /**********************************************************************CREAMOS EL GRAFICO DE LA PREDICCION************************************************************************/

    function createGraphs(dayPredData, date){
        var dataGraphNames = ['Temperatura (°C)', 'Humedad Relativa (%)', 'Prob Precipitación (%)', 'Viento (km/h)'];
        var tempValues = getTempArrayDataForGraph(dayPredData.temperatura);
        var humRelValues = getHumRelArrayDataForGraph(dayPredData.humedadRelativa);
        var [graphLabels, probPrecValues] = getProbPrecArrayDataForGraph(dayPredData.probPrecipitacion);
        var [vientoDirs, vientoValues] = getVientoArrayDataForGraph(dayPredData.viento);
        var canvas = document.getElementById("tempPredGraph").getContext('2d');
        var tempPredGraph = new Chart(canvas, {
            type: 'line',
            data: {
                labels: graphLabels,
                datasets: [{
                    label: dataGraphNames[0],
                    fill: false,
                    data: tempValues,
                    borderColor: '#FF7E0C',
                    pointBorderWidth: 3,
                    pointRadius: 5,
                    borderWidth: 1
                },
                  {
                    label: dataGraphNames[1],
                    fill: false,
                    data: humRelValues,
                    borderColor: '#79A2FB',
                    pointBorderWidth: 3,
                    pointRadius: 5,
                    borderWidth: 1
                },
                  {
                    label: dataGraphNames[2],
                    fill: false,
                    data: probPrecValues,
                    borderColor: '#25ACFF',
                    pointBorderWidth: 3,
                    pointRadius: 5,
                    borderWidth: 1
                },
                  {
                    label: dataGraphNames[3],
                    fill: false,
                    data: vientoValues,
                    borderColor: '#4BC69B',
                    pointBorderWidth: 3,
                    pointRadius: 5,
                    borderWidth: 1
                }],

            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    xAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Horas',
                            fontSize: 15
                        },
                        ticks: {
                            beginAtZero: true
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true
                        }
                    }]
                },
                title: {
                    display: true,
                    text: date,
                    fontSize: 25
                },
                tooltips: {
                    callbacks: {
                        label: function(tooltipItem, data) {
                            var label = data.datasets[tooltipItem.datasetIndex].label + ": " + tooltipItem.value;
                            if(data.datasets[tooltipItem.datasetIndex].label == dataGraphNames[3]){
                                label = data.datasets[tooltipItem.datasetIndex].label + " → Dirección: " + vientoDirs[tooltipItem.datasetIndex] + ". Velocidad: " + tooltipItem.value + " km/h";
                            }
                            return label;
                        }
                    }
                }
            }
        });
    }

    function loadGraphs(dayPredData, date){
        createGraphs(dayPredData, date);
    }

    /***********************************************************************************************************************************************************************************************/

    /**************************************************************OBTENEMOS LOS DATOS PARA LA TABLA QUE IRA DEBAJO DEL GRAFICO DE LA PREDICCION****************************************************/

    function getEstadoCielo(estCielo){
        var tableColumns = new Array();
        var estCieloData = new Array();
        for(var i = 0; i < estCielo.length; i++){
            if(estCielo[i].periodo == "00-24" || estCielo[i].periodo == "00-12" || estCielo[i].periodo == "12-24"){
                continue;
            }
            tableColumns.push(estCielo[i].periodo + "h");
            pushDataToArray(estCieloData, estCielo[i].descripcion);
        }
        return [tableColumns, estCieloData];
    }

    function getCotaNieve(cotaNieve){
        var cotaNieveData = new Array();
        for(var i = 0; i < cotaNieve.length; i++){
            if(cotaNieve[i].periodo == "00-24" || cotaNieve[i].periodo == "00-12" || cotaNieve[i].periodo == "12-24"){
                continue;
            }
            pushDataToArray(cotaNieveData, cotaNieve[i].value);
        }
        return cotaNieveData;
    }

    function getRachaMax(rachaMax){
        var rachaMaxData = new Array();
        for(var i = 0; i < rachaMax.length; i++){
            if(rachaMax[i].periodo == "00-24" || rachaMax[i].periodo == "00-12" || rachaMax[i].periodo == "12-24"){
                continue;
            }
            pushDataToArray(rachaMaxData, rachaMax[i].value);
        }
        return rachaMaxData;
    }

    function getSensTermica(sensTerm){
        var sensTermData = new Array();
        for(var i = 0; i < sensTerm.dato.length; i++){
            pushDataToArray(sensTermData, sensTerm.dato[i].value);
        }
        return sensTermData;
    }

    /****************************************************************************************************************************************************************************************/

    /****************************************************************OBTENEMOS LOS DATOS PARA LA TABLA QUE SE MOSTRARA SI NO HAY GRAFICO*****************************************************/

    function getTableData(dayPredData){
        var estadoCieloData = new Array();
        var cotaNieveProvData = new Array();
        var probPrecData = new Array();
        var rachaMaxData = new Array();
        var tableColumns = new Array();
        for(var i = 0; i < dayPredData.probPrecipitacion.length; i++){
            if(dayPredData.estadoCielo[i].periodo == "00-24" || dayPredData.cotaNieveProv[i].periodo == "00-24" || dayPredData.probPrecipitacion[i].periodo == "00-24" || dayPredData.rachaMax[i].periodo == "00-24"){
                continue;
            }
            tableColumns.push(dayPredData.estadoCielo[i].periodo + "h");
            pushDataToArray(estadoCieloData, dayPredData.estadoCielo[i].descripcion);
            pushDataToArray(cotaNieveProvData, dayPredData.cotaNieveProv[i].value);
            pushDataToArray(rachaMaxData, dayPredData.rachaMax[i].value);
            pushDataToArray(probPrecData, dayPredData.probPrecipitacion[i].value);
        }
        return [tableColumns, estadoCieloData, cotaNieveProvData, rachaMaxData, probPrecData];
    }

    /*****************************************************************************************************************************************************************************************/

    /********************************CREAMOS LAS TABLAS CORRESPONDIENTES DEPENDIENDO DEL TIPO QUE SE ESPECIFIQUE POR PARAMETRO (O ES TABLA DEL GRAFICO O NO)**********************************/

    function createTableRowsTD(tableColumnsValues, estCieloValues, cotaNieveValues, rachaMaxValues, sensTermOrProbPrecValues, type){

        var tableColumns = "<th></th>";
        var rowEstCielo = "<td><b>Estado cielo</b></td>";
        var rowCotaNieve = "<td><b>Cota nieve (m)</b></td>";
        var rowRachaMax = "<td><b>Racha máx (km/h)</b></td>";

        var rowSensTermorProbPrec = "<td><b>Prob precipitación (%)</b></td>";
        if(type == GRAPH_TABLE_TYPE){
            rowSensTermorProbPrec = "<td><b>Sensación térmica (°C)</b></td>";
        }

        for(var i = 0; i < estCieloValues.length; i++){
            tableColumns = tableColumns + "<th>" + tableColumnsValues[i] + "</th>"
            rowEstCielo = rowEstCielo + "<td>" + estCieloValues[i] + "</td>"
            rowCotaNieve = rowCotaNieve + "<td>" + cotaNieveValues[i] + "</td>"
            rowRachaMax = rowRachaMax + "<td>" + rachaMaxValues[i] + "</td>"
            rowSensTermorProbPrec = rowSensTermorProbPrec + "<td>" + sensTermOrProbPrecValues[i] + "</td>"
        }

        return [tableColumns, rowEstCielo, rowCotaNieve, rowRachaMax, rowSensTermorProbPrec];

    }

    function getTableRowsAndColumns(dayPredData, type){
        var [tableColumnsValues, estCieloValues, cotaNieveValues, rachaMaxValues, sensTermValues, probPrecValues] = "";
        var [tableColumns, tdEstCielo, tdCotaNieve, tdRachaMax, tdSensTermOrProbPrec] = "";
        if(type == GRAPH_TABLE_TYPE){

            [tableColumnsValues, estCieloValues] = getEstadoCielo(dayPredData.estadoCielo);
            cotaNieveValues = getCotaNieve(dayPredData.cotaNieveProv);
            rachaMaxValues = getRachaMax(dayPredData.rachaMax);
            sensTermValues = getSensTermica(dayPredData.sensTermica);

            [tableColumns, tdEstCielo, tdCotaNieve, tdRachaMax, tdSensTermOrProbPrec] = createTableRowsTD(tableColumnsValues, estCieloValues, cotaNieveValues, rachaMaxValues, sensTermValues, GRAPH_TABLE_TYPE);
        }
        else{

            [tableColumnsValues, estCieloValues, cotaNieveValues, rachaMaxValues, probPrecValues] = getTableData(dayPredData);

            [tableColumns, tdEstCielo, tdCotaNieve, tdRachaMax, tdSensTermOrProbPrec] = createTableRowsTD(tableColumnsValues, estCieloValues, cotaNieveValues, rachaMaxValues, probPrecValues, TABLE_TYPE);
        }

        return [tableColumns, tdEstCielo, tdCotaNieve, tdRachaMax, tdSensTermOrProbPrec];
    }

    function createTable(dayPredData, type){
        var [tableColumns, tdEstCielo, tdCotaNieve, tdRachaMax, tdSensTermOrProbPrec] = getTableRowsAndColumns(dayPredData, type);
        var table = document.createElement("table");
        table.style="font-size: 15px; text-align: center";
        var thead = document.createElement("thead");
        var tbody = document.createElement("tbody");
        var firstTr = document.createElement("tr");
        var rowEstCielo = document.createElement("tr");
        var rowCotaNieve = document.createElement("tr");
        var rowRachaMax = document.createElement("tr");
        var rowSensTermOrProbPrec = document.createElement("tr");
        firstTr.innerHTML= tableColumns;
        rowEstCielo.innerHTML=tdEstCielo;
        rowCotaNieve.innerHTML=tdCotaNieve;
        rowRachaMax.innerHTML=tdRachaMax;
        rowSensTermOrProbPrec.innerHTML=tdSensTermOrProbPrec;
        thead.appendChild(firstTr);
        table.appendChild(thead);
        tbody.appendChild(rowEstCielo);
        tbody.appendChild(rowCotaNieve);
        tbody.appendChild(rowRachaMax);
        tbody.appendChild(rowSensTermOrProbPrec);
        table.appendChild(tbody);
        return table.outerHTML;
    }

    /************************************************************************************************************************************************************************************************************/

    /***********************************FUNCION PARA DEVOLVER LA SALIDA CORRECTA PARA EL USUARIO DE UN UNICO DATO EN CONCRETO EN FUNCION DE SI HAY INFORMACION AL RESPECTO O NO**********************************/

    function getCorrectData(data){
        var correctData = "Sin datos";
        if(data != null && data != undefined && data.toString() != ""){
            correctData = data.toString();
        }
        return correctData;
    }

    /*************************************************************************************************************************************************************************************************************/

    /**************************************************************FUNCION QUE DEVUELVE UN PARRAFO CON LA INFORMACION DE COPYRIGHT DE AEMET***********************************************************************/

    function getCopyrightInfo(){
        return '<p>Información elaborada por la Agencia Estatal de Meteorología (© AEMET). Más información en su <a href="http://www.aemet.es/es/portada" style="color: #374DC3;" target="_blank">sitio oficial</a></p>';
    }

    /*************************************************************************************************************************************************************************************************************/

    /****************************************************CREAMOS LA TABLA PARA DATOS MINIMOS Y MAXIMOS PARA LAS PREDICCIONES DE LAS QUE DISPONGAMOS DE MENOS INFORMACION******************************************/

    function createMaxMinTable(dayPredData){
        var table = document.createElement("table");
        table.style="font-size: 15px; text-align: center";
        var thead = document.createElement("thead");
        var tbody = document.createElement("tbody");
        var firstTr = document.createElement("tr");
        var rowTemp = document.createElement("tr");
        var rowsensTerm = document.createElement("tr");
        var rowHumRel = document.createElement("tr");
        firstTr.innerHTML= "<th></th><th>Mínima</th><th>Máxima</th>";
        rowTemp.innerHTML= "<td><b>Temperatura (°C)</b></td><td>" + getCorrectData(dayPredData.temperatura.minima) + "</td><td>" + getCorrectData(dayPredData.temperatura.maxima) + "</td>";
        rowsensTerm.innerHTML= "<td><b>Sensación térmica (°C)</b></td><td>" + getCorrectData(dayPredData.sensTermica.minima) + "</td><td>" + getCorrectData(dayPredData.sensTermica.maxima) + "</td>";
        rowHumRel.innerHTML= "<td><b>Humedad relativa (%)</b></td><td>" + getCorrectData(dayPredData.humedadRelativa.minima) + "</td><td>" + getCorrectData(dayPredData.humedadRelativa.maxima) + "</td>";
        thead.appendChild(firstTr);
        table.appendChild(thead);
        tbody.appendChild(rowTemp);
        tbody.appendChild(rowsensTerm);
        tbody.appendChild(rowHumRel);
        table.appendChild(tbody);
        return table.outerHTML;
    }

    /****************************************************************************************************************************************************************************************************************/

    /***************************************************************CREAMOS LA TABLA PARA LA INFORMACION DEL VIENTO PARA CUANDO TENGAMOS DATOS DE 12 HORAS EN 12 HORAS***********************************************/

    function getVientoDataForTable(viento){
        var tableColumns = new Array();
        var vientoDirData = new Array();
        var vientoVelData = new Array();
        for(var i = 0; i < viento.length; i++){
            if(viento[i].periodo == "00-24"){
                continue;
            }
            tableColumns.push(viento[i].periodo + "h");
            pushDataToArray(vientoDirData, viento[i].direccion);
            pushDataToArray(vientoVelData, viento[i].velocidad);
        }
        return [tableColumns, vientoDirData, vientoVelData];
    }

    function createVientoTableRows(viento){
        var [tableColumnsValues, vientoDirValues, vientoVelValues] = getVientoDataForTable(viento);
        var tableColumns = "<th></th>";
        var vientoDir = "<td><b>Dirección</b></td>";
        var vientoVel = "<td><b>Velocidad (km/h)</b></td>";
        for(var i = 0; i < tableColumnsValues.length; i++){
            tableColumns = tableColumns + "<th>" + tableColumnsValues[i] + "</th>";
            vientoDir = vientoDir + "<td>" + vientoDirValues[i] + "</td>";
            vientoVel = vientoVel + "<td>" + vientoVelValues[i] + "</td>";
        }
        return [tableColumns, vientoDir, vientoVel];
    }

    function createVientoTable(viento){
        var [tableColumns, rowVientoDirData, rowVientoVelData] = createVientoTableRows(viento);
        var table = document.createElement("table");
        table.style="font-size: 15px; text-align: center";
        var legend = document.createElement("legend");
        var thead = document.createElement("thead");
        var tbody = document.createElement("tbody");
        var firstTr = document.createElement("tr");
        var rowVientoDir = document.createElement("tr");
        var rowVientoVel = document.createElement("tr");
        legend.innerHTML= "Viento";
        firstTr.innerHTML= tableColumns;
        rowVientoDir.innerHTML= rowVientoDirData;
        rowVientoVel.innerHTML= rowVientoVelData;
        table.appendChild(legend);
        thead.appendChild(firstTr);
        table.appendChild(thead);
        tbody.appendChild(rowVientoDir);
        tbody.appendChild(rowVientoVel);
        table.appendChild(tbody);
        return table.outerHTML;
    }

    /******************************************************************************************************************************************************************************************/

    /*************************************************FUNCION PARA OBTENER LA FECHA CORRECTA SELECCIONADA EN EL FORMATO QUE SE ESPERA******************************************************/

    function getCorrectDateFormat(date){
        var dateAux = date.split("-");
        return dateAux[2] + "-" + dateAux[1] + "-" + dateAux[0];
    }

    /******************************************************************************************************************************************************************************************/

    /****FUNCIONES PARA OBTENER, EN FUNCION DE LAS HORAS DE SOL QUE TIENE CADA MES Y EL INDICE DE PRECIPITACION, EL TIPO DE DIA Y DE PRECIPITACION QUE HUBO EN LA FECHA PASADA SELECCIONADA****/

    function getTypeOfDay(sunHours, prec){
        var typeOfDay = "<figure><img src='https://i.ibb.co/2vfJDKz/no-weather-info-icon.png' alt='Icono de sin datos sobre el tipo de día' width='250' height='250' border='0'></figure><br><p>Sin datos sobre el tipo de día</p>";
        if(sunHours != undefined){
            var hoursMonth = sunHoursOfTorr/2.0;
            console.log("HORAS DE SOL TORREVIEJA: " + sunHoursOfTorr + " HORAS MONTH: " + hoursMonth);
            console.log("SUN HOURS: " + sunHours);

            if(parseFloat(sunHours) < hoursMonth){
                if(prec != "Ip" && parseFloat(prec) > 0.0 && (parseFloat(prec)/24.0) <= 15.0){
                     typeOfDay = "<figure><img src='https://i.ibb.co/0Cnyq1D/lluvia.png' alt='lluvia' width='250' height='250' border='0'></figure><br><p>Lluvioso con horas de sol: " + sunHours + "h</p>";
                }
                else if(prec != "Ip" && (parseFloat(prec)/24.0) > 15.0){
                    typeOfDay = "<figure><img src='https://i.ibb.co/f88rVxv/tormenta.png' alt='tormenta' width='250' height='250' border='0'></figure><br><p>Tormentoso con horas de sol: " + sunHours + "h</p>";
                }
                else{
                    typeOfDay = "<figure><img src='https://i.ibb.co/kKZb6rK/nublado.png' alt='nublado' width='250' height='250' border='0'></figure><br><p>Nublado con horas de sol: " + sunHours + "h</p>";
                }
            }
            else{
                if(prec != "Ip" && parseFloat(prec) > 0.0){
                    typeOfDay = "<figure><img src='https://i.ibb.co/SsSTY8F/sol-con-precipitaciones.png' alt='soleado con precipitaciones' width='250' height='250' border='0'></figure><br><p>Despejado con precipitaciones y con horas de sol: " + sunHours + "h</p>";
                }
                else{
                    typeOfDay = "<figure><img src='https://i.ibb.co/bKg5LFv/soleado.png' alt='soleado' width='250' height='250' border='0'></figure><br><p>Despejado con horas de sol: " + sunHours + "h</p>";
                }
            }

        }
        return typeOfDay;
    }

    function getTypeOfPrec(prec){
        var dayPrec = "<p>";
        if(prec == null || prec == undefined){
            dayPrec = dayPrec + "Sin datos sobre la precipitación que hubo en el día</p>";
        }
        else if(prec == "Ip"){
            dayPrec = dayPrec + "Precipitación inapreciable: < 0.1mm en 24 horas</p>";
        }
        else{
            var precForHour = (parseFloat(prec)/24.0).toFixed(3);
            if(precForHour == 0.0){
                dayPrec = dayPrec + "Sin precipitaciones</p>";
            }
            else if(precForHour > 0.0 && precForHour <= 2.0){
                dayPrec = dayPrec + "Precipitaciones débiles: " + prec + "mm en 24 horas y " + precForHour + "mm por hora</p>";
            }
            else if(precForHour > 2.0 && precForHour <= 15.0){
                dayPrec = dayPrec + "Precipitaciones moderadas: " + prec + " en 24 horas y " + precForHour + "mm por hora</p>";
            }
            else if(precForHour > 15.0 && precForHour <= 30.0){
                dayPrec = dayPrec + "Precipitaciones fuertes: " + prec + " en 24 horas y " + precForHour + "mm por hora</p>";
            }
            else if(precForHour > 30.0 && precForHour <= 60.0){
                dayPrec = dayPrec + "Precipitaciones muy fuertes: " + prec + " en 24 horas y " + precForHour + "mm por hora</p>";
            }
            else{
                dayPrec = dayPrec + "Precipitaciones torrenciales: " + prec + " en 24 horas y " + precForHour + "mm por hora</p>";
            }
        }

        return dayPrec;
    }

    /****************************************************************************************************************************************************************************************************************/

    /************************************************FUNCION PARA CONVERTIR UNA FECHA EN FORMATO ANYO-MES-DIA EN FORMATO UTC ANYADIENDO HORAS-MINUTOS-SEGUNDOS (VALIENDO TODO 0)*************************************/

    function convertDateToUTC(day, month, year){
        return year + "-" + month + "-" + day + "T00:00:00";
    }

    /****************************************************************************************************************************************************************************************************************/

    /***********************************************************MENSAJE MODAL DE ERROR DE SERVIDOR (PRODUCIDO AL HACER LLAMADAS A LA API DE AEMET)*******************************************************************/

    function showServerErrorToUser(){
        Swal.fire({
            title: '<strong>Error en el servidor</strong>',
            icon: 'error',
            html:
            '<p>Se ha producido un error en el servidor de Aemet mientras se estaban recopilando los datos. Por favor, recargue la página para volver a intentarlo.</p>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /*****************************************************************************************************************************************************************************************************************/

    /************MENSAJE MODAL QUE SE MUESTRA MIENTRAS SE ESTAN CARGANDO LOS DATOS PARA REALIZAR LAS LLAMADAS A LA API DE AEMET, EN EL CASO EN EL QUE SE INTERACTUE CON EL SCRIPT ANTES DE QUE SE CARGUEN*************/

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

    /********************************************************************************************************************************************************************************************************************/

    /************************************************MENSAJE MODAL QUE SE MUESTRA CUANDO LA FECHA FUTURA ES DEMASIADO LEJANA Y POR TANTO NO SE TIENEN DATOS SOBRE ELLA A DIA DE HOY**************************************/

    function showNoDataPredictionToUser(date){
        Swal.fire({
            title: '<strong>Sin datos para ' + date + '</strong>',
            icon: 'info',
            html:
            '<p>Lo sentimos, no hay información para esta fecha.</p>',
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /**********************************************************************************************************************************************************************************************************************/

    /***************************************************MENSAJES MODALES DE PREDICCION DE TIEMPO CON GRAFICO, CON 3 TABLAS Y CON SOLAMENTE 1 (FECHA FUTURA CERCANA, MEDIA Y LEJANA)****************************************/

    function showDayPredictionGraphToUser(dayPredData, date){
        console.log(dayPredData);
        Swal.fire({
            title: '<strong>Predicción de tiempo</strong>',
            icon: 'info',
            html:
            '<div><canvas id="tempPredGraph" width="400" height="400"></canvas></div>' +
            '<div style="overflow-x: auto;">' +
            createTable(dayPredData, GRAPH_TABLE_TYPE) + '</div><br>' +
            '<p>Radiación ultravioleta máxima: ' + getCorrectData(dayPredData.uvMax) + '</p><br>' +
            getCopyrightInfo(),
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        }).then(loadGraphs(dayPredData, date)).catch( (dismiss) => {}); // Empleamos una promesa para indicar que se cargaran los graficos cuando el mensaje modal se halla disparado
    }

    function showDayPredictionTableToUser(dayPredData, date){
        console.log(dayPredData);
        Swal.fire({
            title: '<strong>Predicción de tiempo</strong>',
            icon: 'info',
            html:
            '<h3 style="font-size: 1.5em;">' + date + '</h3><br>' +
            '<div style="overflow-x: auto;">' +
            createTable(dayPredData, TABLE_TYPE) + '</div><br>' +
            '<div style="overflow-x: auto;">' +
            createVientoTable(dayPredData.viento) + '</div><br>' +
            '<div style="overflow-x: auto;">' +
            createMaxMinTable(dayPredData) + '</div><br>' +
            '<p>Radiación ultravioleta máxima: ' + getCorrectData(dayPredData.uvMax) + '</p><br>'+
            getCopyrightInfo(),
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    function showDayPredictionToUser(dayPredData, date){
        console.log(dayPredData);
        Swal.fire({
            title: '<strong>Predicción de tiempo</strong>',
            icon: 'info',
            html:
            '<h3 style="font-size: 1.5em;">' + date + '</h3><br>' +
            '<div style="overflow-x: auto;">' +
            createMaxMinTable(dayPredData) + '</div><br>' +
            '<p>Estado cielo: ' + getCorrectData(dayPredData.estadoCielo[0].descripcion) + '</p>' +
            '<p>Prob precipitación (%): ' + getCorrectData(dayPredData.probPrecipitacion[0].value) + '</p>' +
            '<p>Cota nieve (m): ' + getCorrectData(dayPredData.cotaNieveProv[0].value) + '</p>' +
            '<p>Racha max (km/h): ' + getCorrectData(dayPredData.rachaMax[0].value) + '</p>' +
            '<p>Viento → Dirección: ' + getCorrectData(dayPredData.viento[0].direccion) + ". Velocidad (km/h): " + getCorrectData(dayPredData.viento[0].velocidad) +
            '<p>Radiación ultravioleta máxima: ' + getCorrectData(dayPredData.uvMax) + '</p><br>'+
            getCopyrightInfo(),
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /*************************************************************************************************************************************************************************************************/

    /**********************************************************MENSAJE MODAL QUE MUESTRA EL TIEMPO QUE HA HECHO EN UNA FECHA PASADA*******************************************************************/

    function showTimePastToUser(data){
        Swal.fire({
            title: '<strong>TIEMPO DÍA: ' + getCorrectDateFormat(data[0].fecha) + '</strong>',
            icon: 'info',
            html:
            getTypeOfDay(data[0].sol, data[0].prec)
            + '<p>Temperatura máxima (°C): ' + getCorrectData(data[0].tmax) + '</p>'
            + '<p>Temperatura mínima (°C): ' + getCorrectData(data[0].tmin) + '</p>'
            + '<p>Temperatura media (°C): ' + getCorrectData(data[0].tmed) + '</p>'
            + getTypeOfPrec(data[0].prec) + '<br>' +
            getCopyrightInfo(),
            showCloseButton: true,
            showCancelButton: false,
            focusConfirm: false,
            confirmButtonText:
            '<i class="fa fa-thumbs-up"></i> Aceptar',
            confirmButtonAriaLabel: 'Thumbs up, great!',
        });
    }

    /***************************************************************************************************************************************************************************/

    /************************************************FUNCION PARA CONVERTIR EL DIA O EL MES DE UNA FECHA A UN FORMATO DE 2 DIGITOS**********************************************/

    function parseDateNumberToCorrectFormat(dateNumber){
        var correctNumber = String(dateNumber);
        for(var i = correctNumber.length; i < 2; i++){
            correctNumber = '0' + correctNumber;
        }
        return correctNumber;
    }

    /***************************************************************************************************************************************************************************/

    /***************************************OBTENEMOS LOS DATOS DE UNA PREDICCION DE TIEMPO CUANDO SE CLICA EN UNA FECHA FUTURA LLAMANDO A LA API DE AEMET**********************/

    function getDayPredictionProcessed(data, date){
        var dayPredProc = null;
        for(var i = 0; i < data[0].prediccion.dia.length; i++){
            if(data[0].prediccion.dia[i].fecha == date){
                dayPredProc = data[0].prediccion.dia[i];
            }
        }
        return dayPredProc;
    }

    function processDayPrediction(dataUrl, day, month, year){
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.addEventListener("readystatechange", function () {
            if (this.readyState === XMLHttpRequest.DONE) {
                if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                    var data = JSON.parse(this.responseText);
                    console.log(data);
                    var date = convertDateToUTC(day, month, year);
                    var dayPred = getDayPredictionProcessed(data, date);
                    if(dayPred != null && dayPred != undefined){
                        if(dayPred.probPrecipitacion.length == 7){
                            showDayPredictionGraphToUser(dayPred, day + "-" + month + "-" + year);
                        }
                        else if(dayPred.probPrecipitacion.length == 3){
                            showDayPredictionTableToUser(dayPred, day + "-" + month + "-" + year);
                        }
                        else{
                            showDayPredictionToUser(dayPred, day + "-" + month + "-" + year);
                        }
                    }
                    else{
                        showNoDataPredictionToUser(day + "-" + month + "-" + year);
                    }
                }
                else{
                    showServerErrorToUser();
                }
            }
        });

        xhr.open("GET", dataUrl);
        xhr.setRequestHeader("cache-control", "no-cache");
        xhr.send();
    }

    function getDayPrediction(day, month, year){
        console.log(day);
        console.log(month);
        console.log(year);
        var correctDay = parseDateNumberToCorrectFormat(day);
        var correctMonth = parseDateNumberToCorrectFormat(month + 1); // Le incrementamos 1 al mes porque los datos se obtienen con el indice habitual del mes (enero ahora tiene un valor de 1 y no de 0)
        if(torrevieja != null && sunHoursOfTorr != null){
            var xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
            xhr.addEventListener("readystatechange", function () {
                if (this.readyState === XMLHttpRequest.DONE) {
                    if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                        var data = JSON.parse(this.responseText);
                        console.log(data);
                        if(data.estado == 404){ // Si no hay datos para este dia el responseText devolvera el codigo 404 NOT FOUND, el cual se encuentra almacenado en el campo JSON denominado estado dentro de la variable data
                            showNoDataPredictionToUser(correctDay + "-" + correctMonth + "-" + year);
                        }
                        else{
                            processDayPrediction(data.datos, correctDay, correctMonth, year);
                        }
                    }
                    else{
                        showServerErrorToUser();
                    }
                }
            });

            xhr.open("GET", "https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/" + torrevieja.id + "?api_key=" + aemetKey);
            xhr.setRequestHeader("cache-control", "no-cache");
            xhr.send();
        }
        else{
            showNoDataLoadedToUser();
        }
    }

    /************************************************************************************************************************************************************************************************************/

    /***OBTENEMOS LOS DATOS DEL TIEMPO QUE HA HECHO EN EL PASADO EMPLEANDO LA ESTACION MAS CERCANA A TORREVIEJA Y EMPLEANDO LA FECHA SELECCIONADA AL HACER CLICK EN LA IMAGEN CORRESPONDIENTE EN EL CALENDARIO***/

    function processTimePast(dataUrl){
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.addEventListener("readystatechange", function () {
            if (this.readyState === XMLHttpRequest.DONE) {
                if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                    var data = JSON.parse(this.responseText);
                    console.log(data);
                    showTimePastToUser(data);
                }
                else{
                    showServerErrorToUser();
                }
            }
        });

        xhr.open("GET", dataUrl);
        xhr.setRequestHeader("cache-control", "no-cache");
        xhr.send();
    }

    function getDayTimePast(day, month, year){
        console.log(day);
        console.log(month);
        console.log(year);
        var correctDay = parseDateNumberToCorrectFormat(day);
        var correctMonth = parseDateNumberToCorrectFormat(month + 1); // Le incrementamos 1 al mes ya que nos lo almacenamos como valor 0 para poder realizar la comparativa de fechas con now a la hora de insertar las imagenes en el calendario
        var date = convertDateToUTC(correctDay, correctMonth, year) + "UTC";
        if(torrevieja != null && torrevieja.estMasCercana != null && sunHoursOfTorr != null){
            var xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
            xhr.addEventListener("readystatechange", function () {
                if (this.readyState === XMLHttpRequest.DONE) {
                    if(this.status === 0 || (this.status >= 200 && this.status < 400)){
                        var data = JSON.parse(this.responseText);
                        console.log(data);
                        if(data.estado == 404){ // Si no hay datos para este dia el responseText devolvera el codigo 404 NOT FOUND, el cual se encuentra almacenado en el campo JSON denominado estado dentro de la variable data
                            showNoDataPredictionToUser(correctDay + "-" + correctMonth + "-" + year);
                        }
                        else{
                            processTimePast(data.datos);
                        }
                    }
                    else{
                        showServerErrorToUser();
                    }
                }
            });

            xhr.open("GET", "https://opendata.aemet.es/opendata/api/valores/climatologicos/diarios/datos/fechaini/" + date + "/fechafin/" + date + "/estacion/" + torrevieja.estMasCercana.indicativo + "?api_key=" + aemetKey);
            xhr.setRequestHeader("cache-control", "no-cache");
            xhr.send();
        }
        else{
            showNoDataLoadedToUser();
        }
    }

    /************************************************************************************************************************************************************************************************************************/

    /*****FUNCION CON LA QUE INICIAMOS EL SCRIPT OBTENIENDO LOS DATOS DEL MUNICIPIO DE TORREVIEJA Y DE SU ESTACION MAS CERCANA E INSERTANDO LAS IMAGENES CON LOS EVENTOS CORRESPONDIENTES EN EL CALENDARIO DEL SITIO WEB*****/

    function initScript(){
        getMunTorreviejaData();
        insertImagesInCalendar();
    }

    /**************************************************************************************************************************************************************************************************************************/

    /******************************************************************************MAIN DEL SCRIPT EJECUTADO CUANDO LA VENTANA SE HA CARGADO***********************************************************************************/

    window.addEventListener("load", initScript());

    /***************************************************************************************************************************************************************************************************************************/


})();