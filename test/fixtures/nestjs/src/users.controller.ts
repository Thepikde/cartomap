@Controller("users")
export class UsersController {
  @Get() findAll() {}
  @Get(":id") findOne() {}
  @Post() create() {}
}
