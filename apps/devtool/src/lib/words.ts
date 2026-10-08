/**
 * Common English words for passphrases (2396 words, 3 to 9 letters, bundled so nothing is
 * fetched). Each word adds log2(2396) ≈ 11.2 bits of entropy.
 */
export const WORDS: readonly string[] = (
  "able about above absent absorb abstract accept access accident account accuse achieve acid" +
  " " +
  "acorn acquire acre across act action active actor actual adapt add address adjective adjust" +
  " " +
  "admiral admire admit adopt adult advance advent advice aerial affair affix afford afraid" +
  " " +
  "after again against age agency agenda agent agile aglow agree ahead aim air airport aisle" +
  " " +
  "alarm album alert alien alive alley allow almost alone along alpine already also alter always" +
  " " +
  "amazing amber among amount amulet amuse anchor ancient angel anger angle angry animal ankle" +
  " " +
  "announce annual answer antenna antique anvil anxiety any apart apex apology appear apple" +
  " " +
  "approve apron aqua arbor arch archer arctic ardent area arena argue arm armada armor army" +
  " " +
  "aroma around arrange arrest arrive arrow art artisan artist artwork ascend ask aspect aspen" +
  " " +
  "asset assist assume asthma athlete atlas atom attack attend attic attract auction audit aunt" +
  " " +
  "aurora author auto autumn avenue average avocado avoid awake aware away awesome awful awkward" +
  " " +
  "awning axis baby bachelor bacon badge bag bagel bakery balance balcony ball ballad bamboo" +
  " " +
  "banana banjo banner bar barely bargain barley barn barrel base basic basil basin basket batch" +
  " " +
  "battle bay beach beacon beagle beam bean beard beauty beaver because become beef beetle" +
  " " +
  "before begin behave behind believe bellow below belt bench benefit berry best betray better" +
  " " +
  "between beyond bias bicycle bid bike bind bingo biology bird birth biscuit bison bitter black" +
  " " +
  "blade blame blanket blast blaze bleak blend bless blimp blind bliss blood blossom blouse blue" +
  " " +
  "bluff blur blush board boast boat bobcat body boil bolt bone bonfire bonnet bonus book boost" +
  " " +
  "border boring borrow boss bottom boulder bounce bouquet bowl box boy bracket brain bramble" +
  " " +
  "brand brass brave bread breath breeze brew brick bridge brief bright bring brisk broccoli" +
  " " +
  "broken bronze brook broom brother brown brush bubble buckle buddy budget buffalo bugle build" +
  " " +
  "bulb bulk bundle bunker bunny burden burger burrow burst bus business busy butler butter" +
  " " +
  "buyer buzz cabana cabbage cabin cable cactus cadet cage cake call calm camel camera camp" +
  " " +
  "canal cancel candy canoe canopy canvas canyon capable cape capital captain car caramel carbon" +
  " " +
  "card cardinal cargo carpet carrot carry cart case cash cashew castle casual cat catalog catch" +
  " " +
  "category cattle caught cause caution cave cedar ceiling celery cement census century cereal" +
  " " +
  "certain chair chalk champion change chaos chapel chapter charge charm chase chat cheap check" +
  " " +
  "cheese cheetah chef cherry chest chicken chief child chime chimney choice choose chorus" +
  " " +
  "chronic chuckle chunk churn cider cinema cinnamon circle citizen citrus city civil claim clam" +
  " " +
  "clap clarify claw clay clean clerk clever click client cliff climb clinic clip clock clog" +
  " " +
  "close cloth cloud clover clown club clump cluster clutch coach coast cobalt cobra coconut" +
  " " +
  "code coffee coil coin collect color column combine come comet comfort comic common company" +
  " " +
  "compass concert condor conduct confirm congress connect consider control convince cook cookie" +
  " " +
  "cool copper copy coral core corn correct cosmic cost cottage cotton couch cougar country" +
  " " +
  "couple course cousin cover coyote crab crack cradle craft cram crane crash crater crawl" +
  " " +
  "crayon crazy cream credit creek crest crew cricket crime crimson crisp critic crop cross" +
  " " +
  "crouch crowd crown crucial cruel cruise crumble crunch crush cry crystal cube cuckoo culture" +
  " " +
  "cup cupboard cupcake curious current curtain curve cushion custom cute cycle dad dahlia daisy" +
  " " +
  "damage damp dance dandy danger dapper daring dash daughter dawn day deal debate debris decade" +
  " " +
  "decide decline decorate decoy decrease deer defense define defy degree delay deliver delta" +
  " " +
  "demand denial denim dentist deny depart depend deposit depot depth deputy derive describe" +
  " " +
  "desert design desk despair destroy detail detect develop device devote dew diagram dial" +
  " " +
  "diamond diary dice diesel diet differ digital dignity dilemma dingo dinner dinosaur direct" +
  " " +
  "dirt disagree discover disease dish dismiss disorder display distance diver divert divide" +
  " " +
  "dizzy dock doctor document dog doll dolphin domain donate donkey donor doodle door dose" +
  " " +
  "double dove draft dragon dragonfly drama drastic draw dream dress drift drill drink drip" +
  " " +
  "drive drizzle drop drum dry duck dune during dusk dust duty dwarf dynamic dynamo eager eagle" +
  " " +
  "early earn earth easel easily east easy echo eclipse ecology economy edge edit educate eel" +
  " " +
  "effort egg eight either elbow elder electric elegant element elephant elevator elite elk else" +
  " " +
  "embark ember embody embrace emerald emerge emotion employ empower empty emu enable enact end" +
  " " +
  "endless endorse enemy energy enforce engage engine enhance enjoy enlist enough enrich enroll" +
  " " +
  "ensure enter entire entry envelope epic episode equal equator equip era erase erode erosion" +
  " " +
  "error erupt escape essay essence estate eternal ethics evidence evil evoke evolve exact" +
  " " +
  "example excess exchange excite exclude excuse execute exercise exhaust exhibit exile exist" +
  " " +
  "exit exotic expand expect expire explain expose express extend extra eye eyebrow fabric face" +
  " " +
  "faculty fade faint faith falcon fall false fame family famous fan fancy fantasy farm fashion" +
  " " +
  "fat fatal father fatigue fault favorite fawn feast feature federal fee feed feel female fence" +
  " " +
  "fern ferry festival fetch fever few fiber fiction fiddle field fig figure file film filter" +
  " " +
  "final finch find fine finger finish fire firm first fiscal fish fit fitness fix fjord flag" +
  " " +
  "flame flannel flash flat flavor flee flight flint flip float flock floor flower fluid flush" +
  " " +
  "flute fly foal foam focus fog foil fold follow fondue food foot force forest forge forget" +
  " " +
  "fork fortune forum forward fossil foster found fountain fox fragile frame freckle frequent" +
  " " +
  "fresh friend fringe frog front frost frown frozen fruit fudge fuel fun funny furnace fury" +
  " " +
  "future gable gadget gain galaxy gallery galley game gap garage garbage garden garlic garment" +
  " " +
  "garnet gas gasp gate gather gauge gaze gazelle gecko general genius genre gentle genuine" +
  " " +
  "gesture geyser ghost giant gift giggle ginger giraffe girl give glacier glad glance glare" +
  " " +
  "glass glen glide glimpse globe gloom glory glove glow glue gnome goat goblin goddess gold" +
  " " +
  "gondola good goose gopher gorilla gospel gossip govern gown grab grace grain grant grape" +
  " " +
  "grass gravel gravity great green grid grief griffin grit grocery group grove grow grunt guard" +
  " " +
  "guess guide guilt guitar gull gumbo gym habit haiku hair half halo hammer hammock hamster" +
  " " +
  "hand happy harbor hard harp harsh harvest hat hatch have haven hawk hazard hazel head health" +
  " " +
  "heart heavy hedgehog height hello helmet help hen hero heron hickory hidden high hiker hill" +
  " " +
  "hint hip hippo hire history hobby hockey hold hole holiday hollow home honey honeybee hood" +
  " " +
  "hope horizon horn hornet horror horse hospital host hostel hotel hour hover hub huge human" +
  " " +
  "humble hummus humor hundred hungry hunt hurdle hurry hurt husband husky hybrid hymn ice icon" +
  " " +
  "idea identify idle igloo ignore iguana ill illness image imitate immense immune impact impose" +
  " " +
  "improve impulse inch include income increase index indicate indoor industry infant inflict" +
  " " +
  "inform inhale inherit initial inject injury ink inlet inner innocent input inquiry insect" +
  " " +
  "inside inspire install intact interest into invest invite involve iris iron island isolate" +
  " " +
  "issue item ivory jackal jacket jade jaguar jar jasmine jazz jealous jeans jelly jester jewel" +
  " " +
  "jigsaw job join joke jolly journey joy judge juice jump jungle junior juniper junk just" +
  " " +
  "kangaroo kayak keen keep kelp kernel ketchup kettle key kick kid kidney kiln kind kingdom" +
  " " +
  "kiss kit kitchen kite kitten kiwi knee knife knock know koala lab label labor ladder lady" +
  " " +
  "lagoon lake lamp language lantern laptop larch large lark later latte laugh laundry lava law" +
  " " +
  "lawn layer lazy leader leaf learn leave lecture left leg legal legend leisure lemon lemur" +
  " " +
  "lend length lens leopard lesson letter level liberty library license life lift light like" +
  " " +
  "lilac lily limb lime limit linen link lion liquid list little live lizard llama load loan" +
  " " +
  "lobby lobster local lock locket lodge logic lonely long loop lottery lotus loud lounge love" +
  " " +
  "loyal lucky luggage lumber lumen lunar lunch luxury lynx lyrics macaw machine mad magic" +
  " " +
  "magnet magpie maid mail main major make mallard mammal man manage mandate mango manor mansion" +
  " " +
  "mantle manual maple marble margin marine market marlin marriage marsh mask mason mass master" +
  " " +
  "match material math matrix matter maximum maze meadow mean measure meat mechanic medal media" +
  " " +
  "medley melody melt member memory mention menu mercy merge merit merry mesh message metal" +
  " " +
  "meteor method middle midnight milk million mimic mind minimum minor mint minute miracle" +
  " " +
  "mirror miss mistake mitten mix mixed mixture moat mobile mocha model modify molar mom moment" +
  " " +
  "monarch monitor monkey monster month moon moose moral more morning mortar mosquito moss moth" +
  " " +
  "mother motion motor mountain mouse move movie much muffin mule multiply mural muscle museum" +
  " " +
  "mushroom music must mustang mutual myself mystery myth naive name napkin narrow nasty nation" +
  " " +
  "nature near neck nectar need negative neglect neither nephew nerve nest net network neutral" +
  " " +
  "never news next nice night nimbus noble noise nominee noodle normal north nose notable note" +
  " " +
  "nothing notice nova novel now nuclear nugget number nurse nut nutmeg oak oasis obey object" +
  " " +
  "oblige obscure observe obtain obvious occur ocean ocelot octave octopus odor off offer office" +
  " " +
  "often oil okay old olive omelet omit once one onion online only onyx opal open opera opinion" +
  " " +
  "oppose option orange orbit orca orchard orchid order ordinary organ orient original orphan" +
  " " +
  "ostrich other otter outdoor outer outpost output outside oval oven over owl own owner oxygen" +
  " " +
  "oyster ozone pact paddle paddock page pagoda pair palace palette palm panda panel panic" +
  " " +
  "panther papaya paper parade parcel parent park parka parrot party pass pasta pastel patch" +
  " " +
  "path patient patrol pattern pause pave payment peace peach peanut pear peasant pebble pecan" +
  " " +
  "pelican pen penalty pencil penguin peony people pepper perch perfect permit person pet pewter" +
  " " +
  "phoenix phone photo phrase physical piano pickle picnic picture piece pier pig pigeon pilgrim" +
  " " +
  "pill pilot pine pink pinto pioneer pipe pistachio pitch pixel pizza place planet plastic" +
  " " +
  "plate play plaza please pledge pluck plug plum plunge poem poet point polar pole police polka" +
  " " +
  "pond pony pool poppy popular porch portion position possible post potato pottery poverty" +
  " " +
  "powder power practice prairie praise predict prefer prepare present pretty pretzel prevent" +
  " " +
  "price pride primary print priority prism private prize problem process produce profit program" +
  " " +
  "project promote proof property prosper protect proud provide public pudding puffin pug pull" +
  " " +
  "pulp pulse pumpkin punch pupil puppy purchase purity purpose purse push put puzzle pyramid" +
  " " +
  "quail quality quantum quarry quarter quartz question quick quill quilt quit quiz quote rabbit" +
  " " +
  "raccoon race rack radar radio radish raft rail rain raise raisin rally ramp rampart ranch" +
  " " +
  "random range rapid rare rate rather raven raw razor ready real reason rebel rebuild recall" +
  " " +
  "receive recipe record recycle reduce reef reflect reform refuse region regret regular reject" +
  " " +
  "relax release relic relief rely remain remember remind remove render renew rent reopen repair" +
  " " +
  "repeat replace report require rescue resemble resist resource response result retire retreat" +
  " " +
  "return reunion reveal review reward rhino rhythm rib ribbon rice rich riddle ride ridge right" +
  " " +
  "rigid ring ripple risk ritual rival river road roast robin robot robust rocket romance roof" +
  " " +
  "rookie room rooster rose rotate rough round route royal rubber ruby rudder rude rug rule run" +
  " " +
  "rune runway rural sad saddle sadness safe saffron saga sage sail salad salmon salon salsa" +
  " " +
  "salt salute same sample sand sandal sapphire satin satisfy sauce sausage save say scale scan" +
  " " +
  "scare scarf scatter scene scheme school science scissors scone scorpion scout scrap screen" +
  " " +
  "script scrub sea search season seat second secret section security seed seek segment select" +
  " " +
  "sell seminar senior sense sentence sequoia series service session settle setup seven shadow" +
  " " +
  "shaft shallow share shed shell sherbet shield shift shine ship shiver shock shoe shoot shop" +
  " " +
  "shore short shoulder shove shrimp shrub shrug shuffle shy sibling sick side sierra sight sign" +
  " " +
  "silent silk silly silver similar simple since sing siren sister situate six size skate sketch" +
  " " +
  "ski skiff skill skin skirt skull skunk slab slam sled sleep slender slice slide slight slim" +
  " " +
  "slogan slot sloth slow slush small smart smile smoke smooth snack snail snake snap sniff snow" +
  " " +
  "soap soccer social sock soda soft solar soldier solid solution solve someone song sonnet soon" +
  " " +
  "sorry sort soul sound soup source south space spare sparrow spatial spawn speak special speed" +
  " " +
  "spell spend sphere spice spider spike spin spirit split spoil sponsor spoon sport spot spray" +
  " " +
  "spread spring spruce spy square squash squeeze squirrel stable stadium staff stage stairs" +
  " " +
  "stallion stamp stand starling start state stay steak steel stem step stereo stick still sting" +
  " " +
  "stock stomach stone stool stork story stove strategy street strike strong struggle student" +
  " " +
  "stuff stumble style subject submit subway success such sudden suffer sugar suggest suit" +
  " " +
  "summer summit sun sunny sunset super supply supreme sure surface surge surprise surround" +
  " " +
  "survey suspect sustain swallow swamp swan swap swarm swear sweet swift swim swing switch" +
  " " +
  "sword symbol symptom syrup system table tablet tackle taco tadpole tag tail talent talk tango" +
  " " +
  "tank tape tapir target task taste tattoo tavern taxi teach team teapot tell tempo ten tenant" +
  " " +
  "tennis tent term test text thank that theme then theory there they thing this thistle thought" +
  " " +
  "three thrive throw thumb thunder thyme ticket tide tiger tilt timber time tiny tip tired" +
  " " +
  "tissue title toast today toddler toe toffee together toilet token tomato tomorrow tone tongue" +
  " " +
  "tonight tool tooth top topaz topic topple torch tornado tortoise toss total totem toucan" +
  " " +
  "tourist toward tower town toy track trade traffic tragic trail train transfer trap trash" +
  " " +
  "travel tray treat tree trellis trend trial tribe trick trigger trim trip trolley trophy" +
  " " +
  "trouble trout truck true truly trumpet trust truth try tube tuition tulip tumble tuna tundra" +
  " " +
  "tunnel turkey turn turnip turtle tuxedo twelve twenty twice twig twin twist two type typical" +
  " " +
  "umber umbrella unable unaware uncle uncover under undo unfair unfold unhappy unicorn uniform" +
  " " +
  "unique unit universe unknown unlock until unusual unveil update upgrade uphold upon upper" +
  " " +
  "upset urban urchin urge usage use used useful useless usual utility vacant vacuum vague valid" +
  " " +
  "valley valor valve van vanilla vanish vapor various vast vault vehicle velvet vendor venture" +
  " " +
  "venue verb verify verse version very vessel veteran viable vibrant victory video view village" +
  " " +
  "vintage vinyl violet violin viper virtual virus visa visit vista visual vital vivid vocal" +
  " " +
  "voice void volcano volume vote voyage waffle wage wagon wait walk wall walnut walrus want" +
  " " +
  "warbler warm warrior wash wasp waste water wave way wealth wear weasel weather web wedding" +
  " " +
  "weekend weird welcome west wet whale wharf what wheat wheel when where whip whisper whistle" +
  " " +
  "wide width wife wild will willow win window wine wing wink winner winter wire wisdom wise" +
  " " +
  "wish witness wizard wolf woman wombat wonder wood wool word work world worry worth wrap wreck" +
  " " +
  "wren wrestle wrist write wrong yacht yak yard year yellow yeti yodel yogurt you young youth" +
  " " +
  "zebra zenith zephyr zero zigzag zinc zone zoo"
).split(" ");
