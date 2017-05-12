(function(window, undefined) {
    "use strict";

    var ERRORS = {
        // Служебные ошибки
        DATA_REQUIRED: 900,
        YASCHOOL_DIRECTORIES_NOT_BINDED: 901,
        // Ошибки целостности данных, при доабвлении или изменении пункта в расписании
        LESSON_ALREADY_PLANNED_IN_THIS_ROOM_AT_THIS_TIME: 1000,
        LESSON_ALREADY_PLANNED_FOR_THIS_SCHOOL_AT_THIS_TIME: 1001,
        TOO_MANY_STUDENTS_FOR_ROOM: 1002,
        LECTURER_CANNOT_BE_IN_SEVERAL_ROOMS_AT_THE_SAME_TIME: 1003,
        UNKNOWN_SCHOOL: 1004,
        UNKNOWN_LESSON: 1005,
        UNKNOWN_ROOM: 1006,
        UNKNOWN_LECTURER: 1007,
        ITEM_NOT_FOUND: 1008,
        
        /**
         * Получить название ошибки по коду
         * @param  {integer} errorCode - номер ошибки
         * @return {string}            - название ошибки, либо "unknown error"
         */
        getErrorName: function(errorCode) {
            for (var prop in this) {
                if (this.hasOwnProperty(prop)) {
                    if (this[prop] === errorCode)
                        return prop;
                }
            }
            return "unknown error";
        }
    }


    var isFunction = function(f) {
        return f && typeof f === "function";
    }

    var findObjectInArray = function(arr, s, test) {
        for (var i = 0, l = arr.length; i < l; i++) {
            if (test(arr[i], s)) {
                return i;
            }
        }
    }

    var cloneObject = function(a) {
        return JSON.parse(JSON.stringify(a));
    }

    var extend = function(defaults, options) {
        var extended = {};
        var prop;
        for (prop in defaults) {
            if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
                extended[prop] = defaults[prop];
            }
        }
        for (prop in options) {
            if (Object.prototype.hasOwnProperty.call(options, prop)) {
                extended[prop] = options[prop];
            }
        }
        return extended;
    }

    function uniqueArray(a) {
        var seen = {},
            out = [],
            len = a.length,
            j = 0,
            item = null;

        for (var i = 0; i < len; i++) {
            item = a[i];
            if (seen[item] !== 1) {
                seen[item] = 1;
                out[j++] = item;
            }
        }
        return out;
    }




    var Scheduler = {

            config: {
                
            	// Расписание
            	// [  
            	// 		{ _models.schedule_ },
            	// 		{ _models.schedule_ }
            	// 		...
            	// 		{ _models.schedule_ }
            	// ]
                data: [],

                // Т.к. не хотелось хранить избыточные данные и сравнивать лекторов между собой по имени (а также аудитории, школы), 
                // было решено нормализованнать данные.
                // 
                // Лекторы, Школы, Аудитории и Лекции были вынесены в отдельные справочники.
                // 
                // В расписании связывается ДатаВремя с Лектором, Школами, Аудиторией и Лекцией по ключу.
                // 
                // Далее, было решено вынести библиотеку управления справочниками, т.к. она самодостаточна и ее реализация 
                // может быть любой (в том числе ее может не быть вовсе или она уже могла бы быть написана)
                // 
                // Данные справочников подключаются через поле directories
                // Структура объекта directories
                // {
                // 	"schools"	: { _YaSchool.models.school_ },
				// 	"rooms"		: { _YaSchool.models.room_ },
				// 	"lessons"	: { _YaSchool.models.lesson_ },
				// 	"lecturers"	: { _YaSchool.models.lecturer_ },
				// }
				// 
				// В настоящий момент, Scheduler зависит от справочников, только во время проверки целостности
				// например, проверка существования школы/лекции/лектора/аудитории с заданным ключом 
                directories: null
            },


            // Линейное расписание группируется по номеру месяца и по номеру дня 
            // (похоже на дерево: {Месяц}=>{День}=>[lessons])
            // номера месяцев и дней намеренно приводятся в string
            treeScheduleData: {},


            // Для того, чтобы быстро найти нужную ветку >>>{Месяц}=>{День}<<< =>[{_models.schedule_}, ..., {_models.schedule_}] 
            // в дереве расписания
            // 
            // встала необходимость ассоциировать ID пункта расписания с датой лекции (в секундах).
            // Теперь, если мы захотим удалить пункт в расписании по id, 
            // нам достаточно вычислить ветку {Номер месяца}=>{дня}=>[далее в массиве уже можно найти пункт по scheduleId]
            // {"scheduleId":scheduleStartSeconds}
            mapScheduleToDate: {},



            // 
            models: {
                schedule: {
                    "_id": null, // string
                    "plannedDateTime": null, // int дата и время начала лекции в секундах
                    "plannedDateTimeEnd": null, // int дата и время окончания лекции 
                    "lessonId": null, // string ключ в справочнике лекций
                    "lecturerId": null, // string ключ в справочнике лекторов
                    "roomId": null, // string ключ в справочнике аудиторий
                    "schools": [], // array ["hash", "hash", ...] ключи в справочнике аудиторий
                    "isDraft": false, // boolean false - не отображать запланированную лукцию в расписании
                    "hasCookies": false // boolean false - нет печенек, true - есть печеньки 
                }
            },



            // Обработчики событий задаются через метод Scheduler.on
            events: {
                "afterScheduleAdded": null,
                "afterScheduleDeleted": null,
                "afterScheduleUpdated": null,
                "scheduleChanged": null
            },



            // Вернет GUID
            getGUID: function() {
                var S4 = function() {
                    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
                }

                return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
            },



            // Получить расписание в линейном виде (массив объектов [ {_models.schedule_}, {...}, {...} ])
            getPlainScheduleData: function() {
                var a = [],
                    month = null,
                    day = null;

                for (month in this.treeScheduleData) {
                    for (day in this.treeScheduleData[month]) {
                        a.push.apply(a, this.treeScheduleData[month][day]);
                    }
                }

                return a;
            },

            /**
             * Получить расписание, сгруппированное по месяцу и дате
             *
             * Вернет объект:
             * {
             * 		'<monthNum>':{
             * 			'<dayNum>':[ {_models.schedule_}, {...}, {...} ]	
             * 		},
             * 		
             * 		...,
             * 		
             * 		'<monthNum>':{
             * 			'<dayNum>':[ {_models.schedule_}, {...}, {...} ]	
             * 		},
             * }
             * 
             * @return {object} 
             */
            getTreeScheduleData: function() {
                return this.treeScheduleData;
            },



            /**
             * Внутренний метод библиотеки, который во время иннициализации 
             * группирует линейное расписание (массив объектов) 
             * по запланированному месяцу и дате
             * 
             * Структурированные данные доступны в this.treeScheduleData
             * но забирать их лучше методом getTreeScheduleData
             * 
             * @param  {array} 		data  	- массив объектов models.schedule
             * @return {object}		вернет 	- ссылку на Sheduler     
             */
            makeTreeScheduleData: function(data) {
                var date = null,
                    month = null,
                    day = null;

                // Для начала отсортируем расписание по времени начала лекции (старше-выше), т.к. источнику данных не доверяем
                data.sort(function(a, b) {
                    return parseInt(a.plannedDateTime, 10) - parseInt(b.plannedDateTime, 10);
                });

                // Группируем расписание в {monthNum}=>{dayNum}=>[lessons]
                for (var i in data) {

                    date = new Date(data[i].plannedDateTime * 1000);
                    month = date.getUTCMonth().toString();
                    day = date.getUTCDate().toString();

                    if (!this.treeScheduleData[month]) {
                        this.treeScheduleData[month] = {};
                    }

                    if (!this.treeScheduleData[month][day]) {
                        this.treeScheduleData[month][day] = []
                    }

                    // Добавляем запланированную лекцию в соответствующую ветку
                    this.treeScheduleData[month][day].push(data[i]);

                    // Ассоциируем id пункта в расписании с датой
                    this.mapScheduleToDate[data[i]._id] = data[i].plannedDateTime;

                }

                return this;
            },



            /**
             * Иннициализация Scheduler'a
             * 
             * @param  {object} config - содержит поля: data и directories
             * @return {object}        - ссылку на Scheduler
             */
            init: function(config) {

                config = config || {};

                // TODO: check is data Array
                if (!config.data) {
                	// TODO: throw exception
                }

                if (!config.directories) {
                	// TODO: throw exception
                }

                this.config = extend(this.config, config);

                if (this.config.data) {
                    this.makeTreeScheduleData(this.config.data);
                }

                return this;
            },



            /**
             * Установить обработчик события
             * 
             * @example on("afterScheduleAdded", function(){});
             * 
             * @param  {string}   eventName - название события
             * @param  {Function} callback 
             * @return {object}             - вернет ссылку на scheduler
             */
            on: function(eventName, callback) {

                var _this = this;

                if (!isFunction(callback)) {
                    return false; /* todo: throw error */
                }

                if (!eventName) {
                    return false; /* todo: throw error */
                }

                // Event not found
                if (!Object.prototype.hasOwnProperty.call(this.events, eventName)) {
                    return false; /* todo: throw error */
                }

                this.events[eventName] = callback;

                return this;
            }, //on



            /**
             * Конвертация строковой даты и времени формата ДД-ММ-ГГГГ-ЧЧ:ММ в Секунды
             * 
             * @example toSeconds('04-07-2017-19:00') // 1499194800
             * 
             * @param  {string} datetime  	- строка с датой и временем
             * @return {integer}          	- секунды, вернет 0, в случае неудачи
             * @url	http://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript
             */
            toSeconds: function(datetime) {
                var seconds = 0,
                	date = null,
                	time = [];

                // TODO: validate string data
                // 04-07-2017-19:00
                datetime = datetime.split('-');

                datetime[3] = datetime[3].split(':');

                date = new Date(
                	parseInt(datetime[2], 10), 
                	parseInt(datetime[1]-1, 10), 
                	parseInt(datetime[0], 10), 
                	datetime[3][0], 
                	datetime[3][1], 0, 0
                );

                return parseInt((date.getTime() - date.getTimezoneOffset()*60000) / 1000, 10);
                // return new Date( date.toUTCString() ).getTime();
            },




            eachTreeScheduleDay: function(combineFunction) {
            	var month, day;

            	for (month in this.treeScheduleData) {
                    for (day in this.treeScheduleData[month]) {
                    	combineFunction(month, day, this.treeScheduleData[month][day]);
                    } // each day
                } // each month
            },

            eachTreeScheduleItem: function(combineFunction) {
				var month, day, i, l;

            	for (month in this.treeScheduleData) {
                    for (day in this.treeScheduleData[month]) {
                    	for (i = 0, l = this.treeScheduleData[month][day].length; i < l; i++) {
                    		combineFunction(month, day, this.treeScheduleData[month][day][i]);
                    	}
                    } // each day
                } // each month
            },



            /**
             * Получить пункт в расписании по ID
             * @param  {string} id 
             * @return {object} элемент расписания, -1 - если не найдено
             */
            findScheduleById: function(id) {

                var seconds = this.mapScheduleToDate[id],
                    date = new Date(seconds * 1000),
                    month = date.getUTCMonth().toString(),
                    day = date.getUTCDate().toString();

                if (!this.treeScheduleData[month]) {
                    return false;
                }

                if (!this.treeScheduleData[month][day]) {
                    return false;
                }

                var foundIndex = findObjectInArray(this.treeScheduleData[month][day], id, function(item, s) {
                    return item._id === s;
                });

                return this.treeScheduleData[month][day][foundIndex];
            },



            /**
             * Получить расписание для школы в заданном диапазоне дат , сгруппированное по месяцу и дате
             *
             * @example getTreeScheduleBySchool("schoolId") - получить все расписание для указанной школы
             * @example getTreeScheduleBySchool("schoolId", <secondsFrom>) - получить расписание для указанной школы начиная с ДатаВремя (секунды)
             * @example getTreeScheduleBySchool("schoolId", <secondsFrom>, <secondsTo>) - получить расписание для указанной школы начиная с ДатаВремя (секунды) по ДатаВремя (секунды)
             * 
             * @param  {string} schoolId    	- ID школы
             * @param  {integer} secondsFrom 	- дата и время нижней границы диапазона в секундах (default:0)
             * @param  {integer} secondsTo   	- дата и время верхней границы диапазона в секундах (default:9999999999)
             * @return {object}             	- Вернет расписание, сгруппированное по Месяцу и Дню {monthNum}=>{dayNum}=>[...]
             */
            getTreeScheduleBySchool: function(schoolId, secondsFrom, secondsTo) {
				
            	secondsFrom = secondsFrom || 0;
            	secondsTo = secondsTo || 99999999999;

            	secondsFrom = parseInt(secondsFrom);
            	secondsTo = parseInt(secondsTo, 10);

                var a = {};

	            this.eachTreeScheduleItem(function(month, day, item) {
	                // Если дата лекции входит в указанный диапазон, то заносим ее в результирующий массив
	                if (item.plannedDateTime >= secondsFrom 
	                    && item.plannedDateTime <= secondsTo
	                    && item.schools.indexOf(schoolId) !== -1) {
	                    if (!a[month]) {
	                        a[month] = {};
	                    }
	                    if (!a[month][day]) {
	                        a[month][day] = [];
	                    }
	                    a[month][day].push(item);
	                }
	            }); 

                return a;
            },



            /**
             * Получить линейное расписание для школы в заданном диапазоне дат 
             *
             * @example getTreeScheduleBySchool("schoolId") - получить все расписание для указанной школы
             * @example getTreeScheduleBySchool("schoolId", <secondsFrom>) - получить расписание для указанной школы начиная с ДатаВремя (секунды)
             * @example getTreeScheduleBySchool("schoolId", <secondsFrom>, <secondsTo>) - получить расписание для указанной школы начиная 
             * 																	с ДатаВремя (секунды) по ДатаВремя (секунды)
             * 
             * @param  {string} schoolId    	- ID школы
             * @param  {integer} secondsFrom 	- дата и время нижней границы диапазона в секундах (default:0)
             * @param  {integer} secondsTo   	- дата и время верхней границы диапазона в секундах (default:9999999999)
             * @return {object}             	- Вернет расписание, сгруппированное по Месяцу и Дню {monthNum}=>{dayNum}=>[...]
             */
            getPlainScheduleBySchool: function(schoolId, secondsFrom, secondsTo) {

            	secondsFrom = secondsFrom || 0;
            	secondsTo = secondsTo || 99999999999;

            	secondsFrom = parseInt(secondsFrom);
            	secondsTo = parseInt(secondsTo, 10);

                var a = [];

	            this.eachTreeScheduleItem(function(month, day, item) {
	                // Если дата лекции входит в указанный диапазон, то заносим ее в результирующий массив
	                if (item.plannedDateTime >= secondsFrom
	                    && item.plannedDateTime <= secondsTo
	                    && item.schools.indexOf(schoolId) !== -1 ) {
	                    a.push(item);
	                }
	            });

                return a;
            },



            /**
             * Получить расписание для аудитории в заданном диапазоне дат, сгруппированное по месяцу и дате
             * 
             * @example getTreeScheduleByRoom("schoolId") - получить все расписание для указанной аудитории
             * @example getTreeScheduleByRoom("schoolId", <secondsFrom>) - получить расписание для указанной аудитории начиная с ДатаВремя (секунды)
             * @example getTreeScheduleByRoom("schoolId", <secondsFrom>, <secondsTo>) - получить расписание для указанной аудитории начиная 
             * 																	с ДатаВремя (секунды) по ДатаВремя (секунды)
             * @param  {string} schoolId    	- ID аудитории
             * @param  {integer} secondsFrom 	- дата и время нижней границы диапазона в секундах (default:0)
             * @param  {integer} secondsTo   	- дата и время верхней границы диапазона в секундах (default:9999999999)
             * @return {object}             	- Вернет расписание, сгруппированное по Месяцу и Дню {monthNum}=>{dayNum}=>[...]
             */
            getTreeScheduleByRoom: function(roomId, secondsFrom, secondsTo) {

            	secondsFrom = secondsFrom || 0;
            	secondsTo = secondsTo || 99999999999;

            	secondsFrom = parseInt(secondsFrom);
            	secondsTo = parseInt(secondsTo, 10);

                var a = {};

	            this.eachTreeScheduleItem(function(month, day, item) {
	                // Если дата лекции входит в указанный диапазон, то заносим ее в результирующий массив
	                if (item.plannedDateTime >= secondsFrom
	                    && item.plannedDateTime <= secondsTo
	                    && item.roomId === roomId) {
	                    if (!a[month]) {
	                        a[month] = {};
	                    }
	                    if (!a[month][day]) {
	                        a[month][day] = [];
	                    }
	                    a[month][day].push(item);
	                }
	            }); 

                return a;
            },



            /**
             * Получить линейное расписание для аудитории в заданном диапазоне дат
             * 
             * @example getPlainScheduleByRoom("schoolId") - получить все расписание для указанной аудитории
             * @example getPlainScheduleByRoom("schoolId", <secondsFrom>) - получить расписание для указанной аудитории начиная с ДатаВремя (секунды)
             * @example getPlainScheduleByRoom("schoolId", <secondsFrom>, <secondsTo>) - получить расписание для указанной аудитории начиная 
             * 																	с ДатаВремя (секунды) по ДатаВремя (секунды)
             * @param  {string} schoolId    	- ID аудитории
             * @param  {integer} secondsFrom 	- дата и время нижней границы диапазона в секундах (default:0)
             * @param  {integer} secondsTo   	- дата и время верхней границы диапазона в секундах (default:9999999999)
             * @return {object}             	- Вернет расписание, сгруппированное по Месяцу и Дню {monthNum}=>{dayNum}=>[...]
             */
            getPlainScheduleByRoom: function(roomId, secondsFrom, secondsTo) {

            	secondsFrom = secondsFrom || 0;
            	secondsTo = secondsTo || 99999999999;

            	secondsFrom = parseInt(secondsFrom);
            	secondsTo = parseInt(secondsTo, 10);

                var a = [];

	            this.eachTreeScheduleItem(function(month, day, item) {
	                // Если дата лекции входит в указанный диапазон, то заносим ее в результирующий массив
	                if (item.plannedDateTime >= secondsFrom
	                    && item.plannedDateTime <= secondsTo
	                    && item.roomId === roomId) {
	                    a.push(item);
	                }
	            });

                return a;
            },



            // Метод проверки: на указанную дату и время уже запланирована другая лекция?
            isLessonPlanedOnThisTime: function(seconds, scheduleItem) {
                return seconds >= scheduleItem.plannedDateTime && seconds < scheduleItem.plannedDateTimeEnd;
            },


            /**
             * 	Проверка данных на ограничения
             * 	см. ошибки в объекте ERRORS
             * 	
             * 	@param {integer} secondsLessonBegin 	- ДатаВремя начала планируемой лекции в секундах
             * 	@param {integer} secondsLessonDuration 	- Продолжительность лекции в секундах
             * 	@param {object} newSchedule 			- Данные нового пункта в расписании (см. models.schedule)
             * 	@return {integer|false}  				- код ошибки, либо false, если данные целостность не нарушат
             */
            isConstraintsFail: function(secondsLessonBegin, secondsLessonDuration, newSchedule, ignorSelfId) {
                var item;
                var studentsSumInNewSchedule = 0;

                var date = new Date(secondsLessonBegin * 1000),
                    month = date.getUTCMonth().toString(),
                    day = date.getUTCDate().toString();

                if (!this.config.directories) {
                    return ERRORS.YASCHOOL_DIRECTORIES_NOT_BINDED;
                }

                // Школа не найдена
                // TODO: check is schools Array
                for (var i in newSchedule.schools) {
                    if (!this.config.directories.schools[newSchedule.schools[i]]) {
                        return ERRORS.UNKNOWN_SCHOOL;
                    }
                }

                // Аудитория не найдена
                if (!this.config.directories.rooms[newSchedule.roomId]) {
                    return ERRORS.UNKNOWN_ROOM;
                }

                // Лекция не найдена
                if (!this.config.directories.lessons[newSchedule.lessonId]) {
                    return ERRORS.UNKNOWN_LESSON;
                }

                // Лектор не найден
                if (!this.config.directories.lecturers[newSchedule.lecturerId]) {
                    return ERRORS.UNKNOWN_LECTURER;
                }


                // Проходим по лекциям, запланированным на день планируемой лекции 
                // (остальные дни смысла проверять нет)
                for (var i in this.treeScheduleData[month][day]) {

                    item = this.treeScheduleData[month][day][i];

                    // Если нам сказали не проверять целостность самого себя, 
                    // то не будем этого делать (например при редактировании)
                    if (true === ignorSelfId && newSchedule._id === item._id) {
                        // console.log(item._id);
                        continue;
                    }

                    // TODO: Проверять не "наезжает" ли время окончания лекции на следующую лекцию 
                    // в этой аудитории, у этого лектора, для данной школы

                    // Есть Лекция, которая уже запланирована на ту же ДатуВремя что и планируемая?
                    if (this.isLessonPlanedOnThisTime(secondsLessonBegin, item)) {

                        // На эту ДатуВремя в указанной Аудитории уже запланирована Лекция?
                        if (item.roomId === newSchedule.roomId) {
                            // Запланирована. Не разрешаем планировать лкуцию
                            return ERRORS.LESSON_ALREADY_PLANNED_IN_THIS_ROOM_AT_THIS_TIME;
                        }

                        // На эту ДатуВремя для указанной Школы (или школ) уже запланирована лекция?
                        for (var j in newSchedule.schools) {
                            // Хотя бы для одной из указанных Школ уже запланирована Лекции на указанную ДатуВремя?
                            if (item.schools.indexOf(newSchedule.schools[j]) > -1) {
                                // Запланирована. Не разрешаем планировать лкуцию
                                return ERRORS.LESSON_ALREADY_PLANNED_FOR_THIS_SCHOOL_AT_THIS_TIME;
                            }
                        }

                        // Указанный лектор уже запланировал хотябы одну лекцию в это ДатуВремя?
                        if (newSchedule.lecturerId === item.lecturerId) {
                            // Запланировал. Не разрешаем планировать лкуцию
                            return ERRORS.LECTURER_CANNOT_BE_IN_SEVERAL_ROOMS_AT_THE_SAME_TIME;
                        }
                    } // if isLessonPlanedOnThisTime
                }


                // Считаем размер аудитории планируемой лекции  
                for (var i in newSchedule.schools) {
                    studentsSumInNewSchedule += this.config.directories.schools[newSchedule.schools[i]].studentsCount;
                }

                // Require: Вместимость аудитории должна быть больше или равной количеству студентов на лекции
                //console.log("studentsSumInNewSchedule: ", studentsSumInNewSchedule);
                //console.log("Room: ", this.config.directories.rooms[ newSchedule.roomId ]);
                //console.log("Capacity: ", this.config.directories.rooms[ newSchedule.roomId ].capacity);

                // Если размер аудитории планируемой лекции больше, чем вместимость аудитории, то фэйлим валидацию
                if (this.config.directories.rooms[newSchedule.roomId].capacity < studentsSumInNewSchedule) {
                    //console.log( "Требуется мест: "+studentsSumInNewSchedule+", доступно: " + this.config.directories.rooms[ newSchedule.roomId ].capacity );
                    return ERRORS.TOO_MANY_STUDENTS_FOR_ROOM;
                }

                return false;
            },



            /**
             * Запланировать лекцию
             * 
             * @param {int}   		secondsLessonBegin    	- Дата и время начала лекци в секундах
             * @param {int}   		secondsLessonDuration 	- Продолжительность лекции в секундах
             * @param {object}   	scheduleData          	- Параметры нового пункта в расписании (см. models.schedule)
             * @param {function} 	callback              	- в аргумент передается object: {success:true, data:newSchedule}, либо {success:false, errorCode:999}
             * @return {boolean} 							- true - успешно создано, false не создано
             */
            addSchedule: function(secondsLessonBegin, secondsLessonDuration, scheduleData, callback) {

                scheduleData = scheduleData || {};

                if (!secondsLessonBegin || !secondsLessonDuration) {
                    return false;
                }

                if (typeof secondsLessonBegin != 'number' || typeof secondsLessonDuration != 'number') {
                    return false;
                }

                secondsLessonBegin = parseInt(secondsLessonBegin, 10);
                secondsLessonDuration = parseInt(secondsLessonDuration, 10);

                var canAddSchedule = true,
                    errorCode = 0;

                var newSchedule = null;

                var date = new Date(secondsLessonBegin * 1000),
                    month = date.getUTCMonth().toString(),
                    day = date.getUTCDate().toString(),
                    hours = date.getUTCHours(),
                    minutes = date.getUTCMinutes();

                // Создаем эталонный объект
                newSchedule = cloneObject(this.models.schedule);    

                // Обогощаем пустую модель новыми данными
                newSchedule = extend(newSchedule, scheduleData);

                // Убираем дубликаты в списке указанных школ
                newSchedule.schools = uniqueArray(newSchedule.schools);


                // Создаем ветку Месяц в дереве расписания, если ее еще нет
                if (!this.treeScheduleData[month]) {
                    this.treeScheduleData[month] = [];
                }

                // Создаем ветку День в дереве расписания, если ее еще нет
                if (!this.treeScheduleData[month][day]) {
                    this.treeScheduleData[month][day] = [];
                }

                if (errorCode = this.isConstraintsFail(secondsLessonBegin, secondsLessonDuration, newSchedule)) {
                    if (isFunction(callback)) {
                        callback({
                            "success": false,
                            "errorCode": errorCode
                        });
                    }
                    return false;
                }

                // ВАЛИДАЦИЯ ПРОЙДЕНА

                // Устанавливаем уникальный ID нового пункта в расписании
                newSchedule._id = this.getGUID();

                // Устанавливаем запланированное время
                newSchedule.plannedDateTime = secondsLessonBegin;
                newSchedule.plannedDateTimeEnd = secondsLessonBegin + secondsLessonDuration;


                // Добавляем запланированную лекцию в дерево расписания 
                this.treeScheduleData[month][day].push(newSchedule);
                this.treeScheduleData[month][day].sort(function(a, b) {
                    return parseInt(a.plannedDateTime, 10) - parseInt(b.plannedDateTime, 10);
                });

                // Заносим ассоциацию ID расписания с запланированным временем лекции
                // чтобы можно было найти ветку в дереве расписания по ID расписания
                this.mapScheduleToDate[newSchedule._id] = newSchedule.plannedDateTime;

                // Выполняем callback
                if (isFunction(callback)) {
                    callback({
                        success: true,
                        data: newSchedule
                    });
                }

                // Вызываем событие afterScheduleAdded
                if (isFunction(this.events.afterScheduleAdded)) {
                    this.events.afterScheduleAdded({
                        success: true,
                        data: newSchedule
                    });
                }

                // Возвращаем ID нового пункта в расписании
                return true;
            }, //addSchedule


            /*  TODO: Schedule update methods */
            /*setSchedulePlannedDateTime: function(){},
            setSchedulePlannedDateTimeEnd: function(){},
            setScheduleLesson: function(id, lessonId){},
            setScheduleLecturer: function(id, lecturerId){},
            setScheduleRoom: function(id, roomId){},
            setScheduleSchools: function(id, schools){},*/


            // TODO: optimize
            updateSchedule: function(id, scheduleData, callback) {

                scheduleData = scheduleData || {};
                scheduleData._id = id; // "Защита от дурака"

                if (!id) {
                    return false;
                }

                var foundItem = this.findScheduleById(id);

                if (!foundItem) {
                    if (isFunction(callback)) {
                        callback({
                            "success": false,
                            "errorCode": ERRORS.ITEM_NOT_FOUND
                        });
                    }
                    return false;
                }

                // Создаем эталонный объект из старого
                var newSchedule = cloneObject(foundItem);

                // Обогощаем старый объект новыми данными
                newSchedule = extend(newSchedule, scheduleData);

                var duration = newSchedule.plannedDateTimeEnd - newSchedule.plannedDateTime;
                var secondsLessonBegin = parseInt(newSchedule.plannedDateTime, 10);
                var secondsLessonDuration = parseInt(duration, 10);

                var canAddSchedule = true,
                    errorCode = 0;

                var date = new Date(secondsLessonBegin * 1000),
                    month = date.getUTCMonth().toString(),
                    day = date.getUTCDate().toString(),
                    hours = date.getUTCHours(),
                    minutes = date.getUTCMinutes();

                
                // Убираем дубликаты в списке указанных школ
                newSchedule.schools = uniqueArray(newSchedule.schools);


                // Создаем ветку Месяц в дереве расписания, если ее еще нет
                if (!this.treeScheduleData[month]) {
                    this.treeScheduleData[month] = [];
                }

                // Создаем ветку День в дереве расписания, если ее еще нет
                if (!this.treeScheduleData[month][day]) {
                    this.treeScheduleData[month][day] = [];
                }

                if (errorCode = this.isConstraintsFail(secondsLessonBegin, secondsLessonDuration, newSchedule, true)) {
                    if (isFunction(callback)) {
                        callback({
                            "success": false,
                            "errorCode": errorCode
                        });
                    }
                    return false;
                }

                // ВАЛИДАЦИЯ ПРОЙДЕНА

                // Удаляем старый объект
                this.removeScheduleById(id); 


                // Устанавливаем запланированное время
                newSchedule.plannedDateTime = secondsLessonBegin;
                newSchedule.plannedDateTimeEnd = secondsLessonBegin + secondsLessonDuration;

                // Добавляем запланированную лекцию в дерево расписания 
                this.treeScheduleData[month][day].push(newSchedule);
                this.treeScheduleData[month][day].sort(function(a, b) {
                    return parseInt(a.plannedDateTime, 10) - parseInt(b.plannedDateTime, 10);
                });

                // Заносим ассоциацию ID расписания с запланированным временем лекции
                // чтобы можно было найти ветку в дереве расписания по ID расписания
                this.mapScheduleToDate[newSchedule._id] = newSchedule.plannedDateTime;

                // Выполняем callback
                if (isFunction(callback)) {
                    callback({
                        success: true,
                        data: newSchedule
                    });
                }

                // Вызываем событие afterScheduleAdded
                if (isFunction(this.events.afterScheduleAdded)) {
                    this.events.afterScheduleUpdated({
                        success: true,
                        data: newSchedule
                    });
                }

                // Возвращаем ID нового пункта в расписании
                return true;
            },
            


            /**
             * Удаление пункта в расписании
             * 
             * @param  {string}   id       	- ключ пункта в расписании
             * @param  {Function} callback 	- будет выполнен в случае успешного удаления
             * @return {boolean}           	true - удалено, false - не удалено
             */
            removeScheduleById: function(id, callback) {
                if (!id) {
                    return false;
                }

                var seconds = this.mapScheduleToDate[id],
                    date = new Date(seconds * 1000),
                    month = date.getUTCMonth().toString(),
                    day = date.getUTCDate().toString();

                if (!this.treeScheduleData[month]) {
                    return false;
                }

                if (!this.treeScheduleData[month][day]) {
                    return false;
                }

                // 
                var foundIndex = findObjectInArray(this.treeScheduleData[month][day], id, function(item, s) {
                    return item._id === s;
                });

                this.treeScheduleData[month][day].splice(foundIndex, 1);

                // Выполняем callback
                if (isFunction(callback)) {
                    callback();
                }

                // Вызываем событие afterScheduleDeleted
                if (isFunction(this.events.afterScheduleDeleted)) {
                    this.events.afterScheduleDeleted();
                }

                return true;
            } //removeScheduleById



        } // scheduler


    window.Scheduler = Scheduler;
    window.Scheduler.ERRORS = ERRORS;


}(window));