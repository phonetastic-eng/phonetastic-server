/**
 * The complete set of schema.org LocalBusiness type short names (LocalBusiness + all subtypes).
 * Enables O(1) membership checks during JSON-LD entity filtering.
 */
export const LOCAL_BUSINESS_TYPES = new Set<string>([
  'LocalBusiness',

  // AutomotiveBusiness subtypes
  'AutomotiveBusiness',
  'AutoBodyShop',
  'AutoDealer',
  'AutoPartsStore',
  'AutoRental',
  'AutoRepair',
  'AutoWash',
  'GasStation',
  'MotorcycleDealer',
  'MotorcycleRepair',
  'ParkingFacility',
  'ParkingGarage',
  'ParkingLot',

  // EmergencyService subtypes
  'EmergencyService',
  'FireStation',
  'Hospital',
  'PoliceStation',

  // EntertainmentBusiness subtypes
  'EntertainmentBusiness',
  'AdultEntertainment',
  'AmusementPark',
  'ArtGallery',
  'Casino',
  'ComedyClub',
  'MovieTheater',
  'NightClub',

  // FinancialService subtypes
  'FinancialService',
  'AccountingService',
  'AutomatedTeller',
  'BankOrCreditUnion',
  'InsuranceAgency',

  // FoodEstablishment subtypes
  'FoodEstablishment',
  'Bakery',
  'BarOrPub',
  'Brewery',
  'CafeOrCoffeeShop',
  'Distillery',
  'FastFoodRestaurant',
  'IceCreamShop',
  'Restaurant',
  'Winery',

  // GovernmentOffice subtypes
  'GovernmentOffice',
  'PostOffice',

  // HealthAndBeautyBusiness subtypes
  'HealthAndBeautyBusiness',
  'BeautySalon',
  'DaySpa',
  'HairSalon',
  'HealthClub',
  'NailSalon',
  'TattooParlor',

  // HomeAndConstructionBusiness subtypes
  'HomeAndConstructionBusiness',
  'Electrician',
  'GeneralContractor',
  'HVACBusiness',
  'HousePainter',
  'Locksmith',
  'MovingCompany',
  'Plumber',
  'RoofingContractor',

  // LegalService subtypes
  'LegalService',
  'Attorney',
  'Notary',

  // LodgingBusiness subtypes
  'LodgingBusiness',
  'BedAndBreakfast',
  'Campground',
  'Hostel',
  'Hotel',
  'Motel',
  'Resort',
  'VacationRental',

  // MedicalBusiness subtypes
  'MedicalBusiness',
  'CommunityHealth',
  'Dentist',
  'DiagnosticLab',
  'MedicalClinic',
  'Optician',
  'Pharmacy',
  'Physician',
  'VeterinaryCare',

  // SportsActivityLocation subtypes
  'SportsActivityLocation',
  'BowlingAlley',
  'ExerciseGym',
  'GolfCourse',
  'PublicSwimmingPool',
  'SkiResort',
  'SportsClub',
  'SportsCourt',
  'StadiumOrArena',
  'TennisComplex',

  // Store subtypes
  'Store',
  'BikeStore',
  'BookStore',
  'ClothingStore',
  'ComputerStore',
  'ConvenienceStore',
  'DepartmentStore',
  'ElectronicsStore',
  'Florist',
  'FurnitureStore',
  'GardenStore',
  'GroceryOrSupermarket',
  'HardwareStore',
  'HobbyShop',
  'HomeGoodsStore',
  'JewelryStore',
  'LiquorStore',
  'MensClothingStore',
  'MobilePhoneStore',
  'MovieRentalStore',
  'MusicStore',
  'OfficeEquipmentStore',
  'OutletStore',
  'PawnShop',
  'PetStore',
  'ShoeStore',
  'SportingGoodsStore',
  'TireShop',
  'ToyStore',
  'WholesaleStore',

  // Direct LocalBusiness subtypes
  'AnimalShelter',
  'ArchiveOrganization',
  'ChildCare',
  'CleaningService',
  'DryCleaningOrLaundry',
  'EmploymentAgency',
  'InternetCafe',
  'LandmarksOrHistoricalBuildings',
  'Library',
  'NGO',
  'NewsMediaOrganization',
  'OnlineBusiness',
  'OnlineStore',
  'RealEstateAgent',
  'RecyclingCenter',
  'SelfStorage',
  'ShoppingCenter',
  'TravelAgency',
]);
