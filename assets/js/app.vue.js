
var testData = {

	/**
	 * Справочники
	 */
	"schools":{
		"school1":{ "_id":"school1", "title":"Школа разработки интерфейсов", "shortTitle":"ШРИ", "studentsCount":10 },
		"school2":{ "_id":"school2", "title":"Школа мобильного дизайна", "shortTitle":"ШМД", "studentsCount":10 },
		"school3":{ "_id":"school3", "title":"Школа мобильной разработки", "shortTitle":"ШМР", "studentsCount":10 }
	},
	"rooms":{
		"room1":{ "_id":"room1", "title":"Room 1", "capacity":20, "location":"turn right and go go go!" },
		"room2":{ "_id":"room2", "title":"Room 2", "capacity":20, "location":"just go" },
		"room3":{ "_id":"room3", "title":"Room 3", "capacity":20, "location":"run!" }
	},
	"lessons":{
		"lesson1":{ "_id":"lesson1", "title":"Lesson 1" },
		"lesson2":{ "_id":"lesson2", "title":"Lesson 2" },
		"lesson3":{ "_id":"lesson3", "title":"Lesson 3" },
		"lesson4":{ "_id":"lesson4", "title":"Lesson 4" }
	},
	"lecturers":{
		"lecturer1":{ "_id":"lecturer1", "name":"Alexander", "ava":"uploads/ava1.png", "bio":"Все вращается вокруг интерфейсов!" },
		"lecturer2":{ "_id":"lecturer2", "name":"Ivan", "ava":"uploads/ava2.png", "bio":"Хороший дизайн ставит данные на первый план" },
		"lecturer3":{ "_id":"lecturer3", "name":"Anton", "ava":"uploads/ava3.png", "bio":"Антоха перезвонит!" },
		"lecturer4":{ "_id":"lecturer4", "name":"Dron", "ava":"uploads/ava4.png", "bio":"Дрон сказал так сойдет!" }
	},

	/**
	 * Расписание
	 */
 	"schedule":[
		{ "_id":"schedule1", "plannedDateTime":1492369200/*16.04.2017 19:00*/, "plannedDateTimeEnd":1492376400/*16.04.2017 21:00*/, "lessonId":"lesson1", "lecturerId":"lecturer1", "roomId":"room1", "schools":["school1"], "isDraft":false, "hasCookies":true }, 
		{ "_id":"schedule2", "plannedDateTime":1499108400/*03.07.2017 19:00*/, "plannedDateTimeEnd":1499115600/*03.07.2017 21:00*/, "lessonId":"lesson2", "lecturerId":"lecturer1", "roomId":"room1", "schools":["school2", "school3"], "isDraft":false, "hasCookies":false }, 
		{ "_id":"schedule3", "plannedDateTime":1499115600/*03.07.2017 21:00*/, "plannedDateTimeEnd":1499119200/*03.07.2017 22:00*/, "lessonId":"lesson3", "lecturerId":"lecturer3", "roomId":"room2", "schools":["school2"], "isDraft":false, "hasCookies":true },
		{ "_id":"schedule4", "plannedDateTime":1499194800/*03.07.2017 19:00*/, "plannedDateTimeEnd":1499198400/*04.07.2017 20:00*/, "lessonId":"lesson4", "lecturerId":"lecturer4", "roomId":"room3", "schools":["school1", "school3"], "isDraft":false, "hasCookies":true }
	]									   
};


(function(window, undefined) {
	"use strict";

	var APP_PREFFIX = "yaschedule-app";

	// Небольшая обертка для LocalStorage
	var appStorage = {
		fetch: function (item) {
			item = [APP_PREFFIX, item].join('-');
			return JSON.parse( window.localStorage.getItem( item ) );
		},

		save: function (item, data) {
			item = [APP_PREFFIX, item].join('-');
			window.localStorage.setItem(item, JSON.stringify(data))
		}
	}


	// Заполняем localStorage тестовыми данными, если хранилища нет
	var storageTypes = ['schedule', 'lecturers', 'lessons', 'rooms', 'schools' ];
	for (var i in storageTypes) {
		if ( !localStorage.getItem( [APP_PREFFIX, storageTypes[i]].join('-') ) )
		{
			appStorage.save(storageTypes[i], testData[storageTypes[i]] );
		}
	}


	// Momentjs config
	moment.locale('ru');


	/**
	 *  Иннициализация библиотеки YaSchool
	 */
	YaSchool.init({
		data: {
			lecturers 	: appStorage.fetch('lecturers'),
			lessons 	: appStorage.fetch('lessons'),
			rooms 		: appStorage.fetch('rooms'),
			schools 	: appStorage.fetch('schools')
		}
	})
	.on("afterAnyAdded", function(itemType) {
		itemType  = itemType + 's';
		appStorage.save(itemType, YaSchool.getData(itemType) );
		appView.$forceUpdate();
	})
	.on("afterAnyUpdated", function(itemType) {
		itemType  = itemType + 's';
		appStorage.save(itemType, YaSchool.getData(itemType) );
		appView.$forceUpdate();
	})
	.on("afterAnyDeleted", function(itemType) {
		itemType  = itemType + 's';
		appStorage.save(itemType, YaSchool.getData(itemType) );
		appView.$forceUpdate();
	})




	/**
	 * 	Иннициализация библиотеки Scheduler
	 */
	Scheduler.init({
		data: appStorage.fetch('schedule'),
		directories: YaSchool.getData()
	})
	.on("afterScheduleAdded", function() {
		appStorage.save('schedule', Scheduler.getPlainScheduleData() );
		appView.$forceUpdate();
	})
	.on("afterScheduleDeleted", function() {
		appStorage.save('schedule', Scheduler.getPlainScheduleData() );
		appView.$forceUpdate();
	})
	.on("afterScheduleUpdated", function() {
		appStorage.save('schedule', Scheduler.getPlainScheduleData() );
		appView.$forceUpdate();
	});



	// Данные приложения
	var appData = {
		// Расписание
		schedule 	: Scheduler.getTreeScheduleData(),
		// Справочники
		lecturers 	: YaSchool.getData('lecturers'),
		lessons 	: YaSchool.getData('lessons'),
		rooms 		: YaSchool.getData('rooms'),
		schools 	: YaSchool.getData('schools')
	}



	/*
		Vuejs используется только для просмотра
	 */

	var appView = new Vue({

		el: '#scheduleWidget',

		data: {
			/* Заглушка. В будущем нужно брать серверное время 
				и периодически обновлять (sockets/ajaxPooling etc) */
			"serverCurrentTime": parseInt(Date.now()/1000, 10),

			/* TODO: переделать в map */
			"modelFilterByDate": "today",
			"modelFilterBySchoolId": "all",
			"modelFilterByStatusHidePast": false,

			"modelDropdownVisible": {
				"schools": false,
				"date": false
			},

			"modelLecturerBalloons": {},

			/* Передаем справочники в просмотр */
			"schedule": appData.schedule,
			"lecturers": appData.lecturers,
			"lessons": appData.lessons,
			"rooms": appData.rooms,
			/* Передаем расписание в просмотр */
			"schools": appData.schools
		}, // data

		// https://coligo.io/vuejs-filters/

		// Методы просмотра
		methods: {
			/* Mappers */
			lecturerResolve: function(lecturerId) {
				return this.lecturers[ lecturerId ] || "Unknown lecturer: "+lecturerId;
			},
			lessonResolve: function(lessonId) {
				return this.lessons[ lessonId ] || "Unknown lesson: "+lessonId;
			},
			roomResolve: function(roomId) {
				return this.rooms[ roomId ] || "Unknown room: "+roomId;
			},
			schoolResolve: function(schoolId) {
				return this.schools[ schoolId ] || "Unknown school: "+schoolId;
			},
			/* Filters/formatters */
			extractDayNum: function(seconds) {
				var date = new Date( seconds * 1000 )
				return date.getUTCDate();
			},
			extractTime: function(seconds) {
				var date = new Date( seconds * 1000 )
				return [ ('0'+date.getUTCHours()).substr(-2), ('0'+date.getUTCMinutes()).substr(-2) ].join(':');
			},
			/* Conditions */
			isTimePast: function(seconds) {
				return this.serverCurrentTime > parseInt(seconds, 10);
			},
			isToday: function(seconds) {

				var dateNow = new Date( this.serverCurrentTime * 1000 )
					, dayNumNow = dateNow.getUTCDate()
					, monthNumNow = dateNow.getUTCMonth()
					, yearNumNow = dateNow.getUTCFullYear()
					;

				var date = new Date( seconds * 1000 )
					, dayNum = date.getUTCDate()
					, monthNum = date.getUTCMonth()
					, yearNum = date.getUTCFullYear()
					;

				return dayNum === dayNumNow && monthNum === monthNumNow && yearNum === yearNumNow;
			},
			/* Balloons */
			showBalloon: function(balloonId) {
				//this.hideAllBalloons(); // TODO: hide only last balloon
				this.hideAllDropdowns();
				var b;
				b = !!this.modelLecturerBalloons[balloonId];
				this.hideAllBalloons();
				this.modelLecturerBalloons[balloonId] = !b;
				this.$forceUpdate();
				return false;
			},
			hideAllBalloons: function() {
				for (var i in this.modelLecturerBalloons) {
					this.modelLecturerBalloons[i] = false;
				}
				this.$forceUpdate();
			},
			isBalloonVisible: function(balloonId) {
				return this.modelLecturerBalloons[balloonId];
			},
			/* Dropdowns */
			hideAllDropdowns: function() {
				for (var i in this.modelDropdownVisible) {
					this.modelDropdownVisible[i] = false;
				}
			},
			toggleDropdown: function(listId) {
				var b;
				this.hideAllBalloons();
				b = this.modelDropdownVisible[listId];
				this.hideAllDropdowns();
				this.modelDropdownVisible[listId] = !b;
				return false;
			},
			isDropdownVisible: function(listId) {
				return this.modelDropdownVisible[listId];
			},

			/* Filters */
			setFilterByDate: function(mode, event) {
				this.modelFilterByDate = mode;
				this.hideAllDropdowns();
				if (event) {
					event.preventDefault();
				}
				return false;
			},
			setFilterBySchoolId: function(schoolId, event) {
				this.modelFilterBySchoolId = schoolId;
				this.hideAllDropdowns();
				if (event) {
					event.preventDefault();
				}
				return false;
			},
			toggleFilterByStatus: function(event) {
				this.modelFilterByStatusHidePast = !this.modelFilterByStatusHidePast;
				if (event) {
					event.preventDefault();
				}
			},


			isSelectedFilterBySchoolId: function(schoolId) {
				return schoolId === this.modelFilterBySchoolId;
			},
			isSelectedFilterByDate: function(mode) {
				if ('today' === mode) {
					return 'today' === this.modelFilterByDate;
				}
				// mode в этом случае будет равен номеру месяца
				return  mode === this.modelFilterByDate;
			},



			filterBySchoolId: function(item) {
				if (!this.modelFilterBySchoolId || 'all' === this.modelFilterBySchoolId) {
					return true;
				}
				return item.schools.indexOf(this.modelFilterBySchoolId) !== -1;
			},
			filterByStatus: function (item) {
				if (true === this.modelFilterByStatusHidePast && this.isTimePast(item.plannedDateTime)) {
					return false;
				}
				return true;
			},
			filterByDate: function (item) {

				if ('today' === this.modelFilterByDate) {
					return this.isToday(item.plannedDateTime);
				}

				var date = new Date(item.plannedDateTime * 1000);
				return (date.getUTCMonth()+1) === this.modelFilterByDate;
			},

			getFilteredMonths: function() { 

				var o  = {};

				if ('today' === this.modelFilterByDate) {
					// Вернем сегодняшний номер месяца, чтобы в просмотре не было других пустых месяцев 
					// (т.к. в них нет лекций по фильтру Сегодня)
					var date = new Date(this.$data.serverCurrentTime*1000);
					o[ date.getUTCMonth().toString() ] = "";
					return o;
				}

				// Иначе покажем все дни на выбранный месяц
				var monthNum = ~~this.modelFilterByDate;
				monthNum--; // т.к. в JS месяцы начинаются с 0
				o[ monthNum.toString() ] = "";
				return o;
			},

			getFilteredDates: function(monthNum) {
				var _this = this;
				var o  = {};
				if ('today' === this.modelFilterByDate) {
					var date = new Date(this.$data.serverCurrentTime*1000);
					o[ date.getUTCDate().toString() ] = "";
					return o;
				}

				// Иначе, вернем список номеров дней, в выбранном месяце, на которые есть запланированные лекции
				Scheduler.eachTreeScheduleDay(function(monthNum, dayNum, item) {
					/*Если месяц равен выбранному в фильтре, то добавляем его дни в результат*/
					if (~~monthNum === ~~_this.modelFilterByDate-1) { 
						o[ dayNum ] = "";
					}
				});

				return o;
			}

		} // methods

	}); // new Vue

	// Регистрируем приложение в области видимости окна (если кто-то пожелает пообщаться с ним)
	window.scheduleWidget = appView;

}(window));





